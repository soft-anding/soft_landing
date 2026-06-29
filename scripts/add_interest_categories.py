#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מוסיף לכל שורה בטבלת rights_items רשימת "קטגוריות עניין" (interest_categories)
שתואמת לרשימה הסגורה שמשתמשים בוחרים מתוכה בפרופיל שלהם (user_profiles.interest_categories).

לפני ההרצה - יש להוסיף לטבלה את העמודות החדשות (פעם אחת, ב-SQL editor של סופאבייס):

    ALTER TABLE rights_items ADD COLUMN IF NOT EXISTS interest_categories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE rights_items ADD COLUMN IF NOT EXISTS interest_categories_needs_review boolean DEFAULT false;

--- הפעלה ---
1. pip install -r requirements_static.txt   (requests + python-dotenv, בלי AI)
2. ודאו ש-.env מכיל SUPABASE_URL ו-SUPABASE_SERVICE_KEY
3. python add_interest_categories.py --dry-run   # מציג מה ישתנה, בלי לכתוב
   python add_interest_categories.py              # מעדכן בפועל בדאטהבייס
"""

import os
import sys
import time
import argparse

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
TABLE_NAME = os.environ.get("TABLE_NAME", "rights_items")
REQUEST_TIMEOUT = 20

# ============================================================
# הרשימה הסגורה של קטגוריות עניין (כפי ששלחה המשתמשת)
# ============================================================
ALL_INTEREST_CATEGORIES = [
    "parking_permit", "rights_general", "senior_benefits", "arnona_discount",
    "arnona_general", "שירותים חשובים", "חינוך", "בירוקרטיה כללית",
    "לוגיסטיקות", "רכב",
]

# שלב 1: מיפוי בסיסי לפי עמודת category הקיימת (1:1, בטוח)
CATEGORY_BASE_MAP = {
    "parking_permit": ["parking_permit", "רכב"],
    "rights_general": ["rights_general"],
    "arnona_general": ["arnona_general"],
    "arnona_discount": ["arnona_discount"],
    "senior_benefits": ["senior_benefits", "שירותים חשובים"],
    "חינוך": ["חינוך", "שירותים חשובים"],
}
DEFAULT_BASE_CATEGORIES = ["rights_general"]  # אם category לא מוכר

# שלב 2: כללי מילות מפתח (ערכו/הוסיפו כאן בחופשיות) -> קטגוריית עניין נוספת
# חיפוש לא תלוי-רישיות, סאבסטרינג פשוט, בטקסט המאוחד של title_he+description+clean_content
KEYWORD_RULES = [
    (
        "רכב",
        ["רכב", "חניה", "חניון", "רישוי רכב", "רישיון נהיגה", "טסט", "ביטוח רכב", "אגרת רישוי"],
    ),
    (
        "לוגיסטיקות",
        [
            "מעבר דירה", "שינוי מחזיקים", "העברת חשבון", "חיבור חשמל", "חיבור מים",
            "חיבור גז", "ניתוק חשמל", "מובילים", "הובלה", "עדכון כתובת", "שינוי כתובת", "דואר",
        ],
    ),
    (
        "בירוקרטיה כללית",
        ["טופס", "ועדה", "ועדת", "ערעור", "הליך", "בקשה", "תעודת זהות", "רישום", "אישור זכאות"],
    ),
    (
        "שירותים חשובים",
        [
            "בריאות", "קופת חולים", "רווחה", "תעסוקה", "אבטלה", "ביטוח לאומי",
            "מרפאה", "מתנ\"ס", "ספרייה", "טיפות חלב", "משרד הבריאות",
        ],
    ),
]

# כללים נוספים שמתבססים על עמודת tags הקיימת (לא רק על טקסט חופשי)
TAG_BASED_RULES = [
    ("needs_movers", "לוגיסטיקות"),
]


def compute_interest_categories(row: dict):
    """row צריך להכיל: category, title_he, description, clean_content, tags (list)"""
    categories = set(CATEGORY_BASE_MAP.get(row.get("category"), DEFAULT_BASE_CATEGORIES))
    fuzzy_matched = False  # האם קטגוריה "חדשה" (מהארבע) נמצאה דרך מילת מפתח/תגית

    combined_text = " ".join(filter(None, [
        row.get("title_he") or "",
        row.get("description") or "",
        row.get("clean_content") or "",
    ]))

    for target_category, keywords in KEYWORD_RULES:
        if any(kw in combined_text for kw in keywords):
            if target_category not in categories:
                fuzzy_matched = True
            categories.add(target_category)

    row_tags = row.get("tags") or []
    for tag, target_category in TAG_BASED_RULES:
        if tag in row_tags:
            if target_category not in categories:
                fuzzy_matched = True
            categories.add(target_category)

    # שמירה על סדר עקבי לפי הרשימה הסגורה
    ordered = [c for c in ALL_INTEREST_CATEGORIES if c in categories]

    needs_review = not fuzzy_matched  # לא נמצאה אף קטגוריה "חדשה" - שווה בדיקה ידנית
    return ordered, needs_review


def supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_all_rows():
    endpoint = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    params = {"select": "id,category,title_he,description,clean_content,tags"}
    resp = requests.get(endpoint, headers=supabase_headers(), params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def update_row(row_id, interest_categories, needs_review):
    endpoint = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    params = {"id": f"eq.{row_id}"}
    headers = supabase_headers()
    headers["Prefer"] = "return=minimal"
    body = {
        "interest_categories": interest_categories,
        "interest_categories_needs_review": needs_review,
    }
    resp = requests.patch(endpoint, headers=headers, params=params, json=body, timeout=REQUEST_TIMEOUT)
    if resp.status_code >= 300:
        raise RuntimeError(f"שגיאת עדכון (id={row_id}, status={resp.status_code}): {resp.text}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="רק להציג מה ישתנה, בלי לכתוב לדאטהבייס")
    args = parser.parse_args()

    missing = [n for n, v in [("SUPABASE_URL", SUPABASE_URL), ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY)] if not v]
    if missing:
        print(f"חסרים משתני סביבה: {', '.join(missing)}")
        sys.exit(1)

    print("שולף את כל השורות מהדאטהבייס...")
    rows = fetch_all_rows()
    print(f"נמצאו {len(rows)} שורות.\n")

    updated, flagged_for_review, failed = 0, 0, 0

    for row in rows:
        try:
            categories, needs_review = compute_interest_categories(row)

            title = row.get("title_he", "")[:50]
            flag = " ⚠️ לבדיקה ידנית" if needs_review else ""
            print(f"[{row['id']}] {title} -> {categories}{flag}")

            if needs_review:
                flagged_for_review += 1

            if not args.dry_run:
                update_row(row["id"], categories, needs_review)
                updated += 1

        except Exception as e:
            print(f"   !! שגיאה בשורה {row.get('id')}: {e}")
            failed += 1

        if not args.dry_run:
            time.sleep(0.2)

    print("\n" + "=" * 50)
    if args.dry_run:
        print(f"[DRY RUN] {len(rows)} שורות עובדו (לא נכתב לדאטהבייס). מתוכן {flagged_for_review} מסומנות לבדיקה ידנית.")
    else:
        print(f"סיכום: עודכנו {updated} | נכשלו {failed} | מסומנות לבדיקה ידנית: {flagged_for_review}")


if __name__ == "__main__":
    main()