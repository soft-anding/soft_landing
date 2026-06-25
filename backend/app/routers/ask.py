"""RAG-based /api/ask endpoint.

Flow per request:
  1. Embed the user's query via Voyage AI (voyage-3, 1024 dims).
  2. Call match_rights_items RPC (filtered by city_id if provided).
  3. Call match_moving_tasks RPC.
  4. Pass retrieved context + user profile to Claude (claude-sonnet-4-6).
  5. Return the synthesised answer + the source rows used.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..config import settings
from ..supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ask"])

VOYAGE_MODEL   = "voyage-3"
CLAUDE_MODEL   = "claude-sonnet-4-6"
RIGHTS_TOP_N   = 6
TASKS_TOP_N    = 3
MIN_SIMILARITY = 0.35   # discard results below this cosine similarity

# ── Request / response schemas ────────────────────────────────────────────────

class UserProfile(BaseModel):
    city_slug:  str | None = None
    is_senior:  bool = False
    is_student: bool = False
    is_new_immigrant: bool = False
    is_reservist: bool = False
    has_car:    bool = False
    extra:      dict[str, Any] = {}


class AskRequest(BaseModel):
    query:   str
    profile: UserProfile = UserProfile()


class SourceRow(BaseModel):
    id:         int
    item_type:  str   # 'rights_item' | 'moving_task'
    title_he:   str | None
    category:   str | None
    source_url: str | None
    verified:   bool
    similarity: float


class AskResponse(BaseModel):
    answer:  str
    sources: list[SourceRow]


# ── Voyage AI ─────────────────────────────────────────────────────────────────

async def _embed_query(text: str) -> list[float]:
    if not settings.voyage_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VOYAGE_API_KEY is not configured on the server.",
        )
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            "https://api.voyageai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.voyage_api_key}"},
            json={"model": VOYAGE_MODEL, "input": [text]},
        )
        if not r.is_success:
            logger.error("Voyage API error %d: %s", r.status_code, r.text[:300])
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Embedding service error: {r.status_code}",
            )
        return r.json()["data"][0]["embedding"]


# ── Supabase vector search ────────────────────────────────────────────────────

def _resolve_city_id(city_slug: str | None) -> int | None:
    if not city_slug:
        return None
    sb = get_supabase()
    res = sb.table("cities").select("id").eq("slug", city_slug).maybe_single().execute()
    return res.data["id"] if res.data else None


def _match_rights(embedding: list[float], city_id: int | None) -> list[dict]:
    sb = get_supabase()
    res = sb.rpc(
        "match_rights_items",
        {
            "query_embedding": embedding,
            "match_city_id":   city_id,
            "match_count":     RIGHTS_TOP_N,
        },
    ).execute()
    return res.data or []


def _match_tasks(embedding: list[float]) -> list[dict]:
    sb = get_supabase()
    res = sb.rpc(
        "match_moving_tasks",
        {
            "query_embedding": embedding,
            "match_count":     TASKS_TOP_N,
        },
    ).execute()
    return res.data or []


# ── Claude synthesis ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
אתה עוזר אישי לאנשים שעוברים דירה בישראל — עולים חדשים ותושבים ותיקים כאחד.
התפקיד שלך הוא לסייע בהבנת זכויות, הנחות וצעדים נדרשים במעבר דירה.

חוקים שאסור לחרוג מהם:
1. ענה אך ורק על בסיס המידע שסופק לך בשאלה זו. אל תמציא תנאי זכאות, סכומים או מועדים שאינם מופיעים במידע שניתן.
2. אם שורת מידע מסומנת verified=false, הוסף הסתייגות ברורה, למשל: "לפי מידע שטרם אומת מהמקור הרשמי".
3. לכל עובדה ספציפית שאתה מציין, ציין גם את מקור המידע (source_url).
4. אם אף אחד מהמידעים שסופקו אינו רלוונטי לשאלה — אמור זאת בגלוי במקום לנסות להתאים תשובה מ억ה.
5. שקול את פרופיל המשתמש: אם המשתמש אינו בעל רכב, אל תציין תו חניה; אם אינו בגיל הפרישה, אל תציין הנחות לאזרחים ותיקים וכדומה.
6. כתוב בעברית, בצורה ישירה ומעשית. אל תעלה על 250 מילה בתשובה.
"""

def _build_context(rights: list[dict], tasks: list[dict]) -> str:
    blocks: list[str] = []

    for r in rights:
        sim = r.get("similarity", 0)
        verified_note = "" if r.get("verified") else " [לא אומת]"
        blocks.append(
            f"[rights_item | {r.get('category','')} | similarity={sim:.2f}{verified_note}]\n"
            f"כותרת: {r.get('title_he','')}\n"
            f"{r.get('clean_content','')}\n"
            f"מקור: {r.get('source_url','')}"
        )

    for t in tasks:
        sim = t.get("similarity", 0)
        verified_note = "" if t.get("verified") else " [לא אומת]"
        blocks.append(
            f"[moving_task | {t.get('category','')} | similarity={sim:.2f}{verified_note}]\n"
            f"כותרת: {t.get('title_he','')}\n"
            f"{t.get('clean_content','')}\n"
            f"מקור: {t.get('source_url','')}"
        )

    return "\n\n---\n\n".join(blocks) if blocks else "(לא נמצא מידע רלוונטי)"


def _build_user_message(query: str, profile: UserProfile, context: str) -> str:
    profile_lines = [f"עיר: {profile.city_slug or 'לא צוין'}"]
    if profile.is_senior:          profile_lines.append("אזרח ותיק: כן")
    if profile.is_student:         profile_lines.append("סטודנט: כן")
    if profile.is_new_immigrant:   profile_lines.append("עולה חדש: כן")
    if profile.is_reservist:       profile_lines.append("חייל מילואים: כן")
    if profile.has_car:            profile_lines.append("בעל רכב: כן")
    for k, v in profile.extra.items():
        profile_lines.append(f"{k}: {v}")

    return (
        f"פרופיל המשתמש:\n{chr(10).join(profile_lines)}\n\n"
        f"שאלה: {query}\n\n"
        f"מידע שנמצא:\n{context}"
    )


async def _call_claude(query: str, profile: UserProfile, context: str) -> str:
    if not settings.anthropic_api_key:
        return (
            "(Claude API key לא מוגדר. "
            "הגדר ANTHROPIC_API_KEY בקובץ backend/.env כדי לקבל תשובות מסונתזות.)"
        )

    from anthropic import AsyncAnthropic  # lazy — optional dependency
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=800,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_message(query, profile, context)}],
    )
    return message.content[0].text  # type: ignore[union-attr]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
async def ask(
    body: AskRequest,
    _user: CurrentUser = Depends(get_current_user),
) -> AskResponse:
    """Embed the query, retrieve similar catalog rows, synthesise an answer."""

    # 1. Embed
    embedding = await _embed_query(body.query)

    # 2. Retrieve
    city_id   = _resolve_city_id(body.profile.city_slug)
    rights    = _match_rights(embedding, city_id)
    tasks     = _match_tasks(embedding)

    # 3. Filter by minimum similarity
    rights = [r for r in rights if (r.get("similarity") or 0) >= MIN_SIMILARITY]
    tasks  = [t for t in tasks  if (t.get("similarity") or 0) >= MIN_SIMILARITY]

    # 4. Synthesise
    context = _build_context(rights, tasks)
    answer  = await _call_claude(body.query, body.profile, context)

    # 5. Build source list
    sources: list[SourceRow] = [
        SourceRow(
            id=r["id"], item_type="rights_item",
            title_he=r.get("title_he"), category=r.get("category"),
            source_url=r.get("source_url"), verified=bool(r.get("verified")),
            similarity=round(r.get("similarity", 0), 3),
        )
        for r in rights
    ] + [
        SourceRow(
            id=t["id"], item_type="moving_task",
            title_he=t.get("title_he"), category=t.get("category"),
            source_url=t.get("source_url"), verified=bool(t.get("verified")),
            similarity=round(t.get("similarity", 0), 3),
        )
        for t in tasks
    ]

    return AskResponse(answer=answer, sources=sources)
