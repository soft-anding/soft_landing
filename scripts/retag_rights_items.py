#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מעדכן את תגיות האוכלוסייה (tags) בטבלת rights_items לרמת פריט ספציפי.

הבעיה: migration 0011 תייג את כל arnona_discount עם כל אוכלוסיות הזכאות
(student, discharged_soldier, reservist, ...), כך שמשתמש שהוא student רואה
גם פריטים המיועדים לחיילים כי יש חפיפה.

הפתרון: ניתוח תוכן (title_he + description + eligibility_conditions) לכל פריט
ותיוג ספציפי לפי אוכלוסייה שהפריט ממש מיועד לה.
אם לא זוהתה אוכלוסייה ספציפית → ["general"] (מוצג לכולם).

--- הפעלה ---
1. ודאו ש-.env מכיל SUPABASE_URL ו-SUPABASE_SERVICE_KEY
2. python retag_rights_items.py --dry-run   # מציג מה ישתנה, בלי לכתוב
   python retag_rights_items.py              # מעדכן בפועל בדאטהבייס
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
TABLE_NAME = "rights_items"
REQUEST_TIMEOUT = 20

# ============================================================
# מיפוי אוכלוסייה → מילות מפתח בעברית
# הערכים (מפתחות) חייבים להתאים ל-special_eligibility בפרופיל המשתמש
# ============================================================
POPULATION_KEYWORDS = {
    "discharged_soldier": [
        "חייל משוחרר", "חיילים משוחררים", "שחרור מהצבא", "שחרור משירות",
        "חייל בודד", "חיילים בודדים", "לחיילים", "חייל", "חיילי",
        "שחרור", "שירות סדיר", "מסלול חיילים", "צה\"ל", "שירות צבאי",
    ],
    "reservist": [
        "מילואים", "מילואימניק", "שירות מילואים", "חיילי מילואים",
        "משרתי מילואים", "לחיילי מילואים",
    ],
    "student": [
        "סטודנט", "סטודנטים", "לומד", "לומדת", "תלמיד", "תלמידים",
        "לימודים גבוהים", "אוניברסיטה", "מכללה", "מוסד אקדמי",
    ],
    "single_parent": [
        "חד הורי", "חד-הורי", "חד הורית", "הורה יחיד", "הורה בודד",
        "חד הוריות", "משפחה חד הורית",
    ],
    "senior_citizen": [
        "קשיש", "קשישים", "גיל הזהב", "פנסיה", "פנסיונר", "גמלאי", "גמלאות",
        "בן 60", "בן 65", "מבוגר", "אזרח ותיק",
    ],
    "new_immigrant": [
        "עולה חדש", "עולים חדשים", "קליטת עלייה", "חדש לארץ",
        "ותק בארץ", "עולים", "קליטה",
    ],
    "disability": [
        "נכות", "נכה", "אנשים עם מוגבלות", "בעל מוגבלות", "מוגבלות",
        "מוגבלויות", "קצבת נכות", "ביטוח נכות",
        "עיוורים", "עיוור", "לקויי ראייה", "לקויי",
    ],
    "has_car": [
        "רכב", "מכונית", "חנייה", "חניה", "חניון", "רישיון רכב",
        "רישוי רכב", "אגרת רישוי", "טסט", "ביטוח רכב",
    ],
    "with_family": [
        "ילדים", "משפחה עם ילדים", "הורים לילדים", "תינוק", "ילד",
    ],
}

# קטגוריות שכבר מתויגות נכון ברמת קטגוריה — נשמור על הבסיס שלהן
# ומוסיפים עליו ממצאי ניתוח הטקסט
CATEGORY_BASE_TAGS = {
    "parking_permit": ["has_car"],
    "senior_benefits": ["senior_citizen"],
    # שאר הקטגוריות ייקבעו לפי ניתוח תוכן
}

# קטגוריות שתמיד "general" — רלוונטיות לכל מי שעובר דירה
# rights_general אינה כאן כי מכילה פריטים ספציפיים לאוכלוסיות
ALWAYS_GENERAL_CATEGORIES = {"address_update", "arnona_general"}


def detect_populations(row: dict) -> list[str]:
    """מנתח תוכן הפריט ומחזיר רשימת תגי אוכלוסייה ספציפיים."""
    category = row.get("category") or ""

    # קטגוריות אוניברסליות — תמיד general
    if category in ALWAYS_GENERAL_CATEGORIES:
        return ["general"]

    # קטגוריות שתגיהן ידועות מראש (base)
    base_tags = set(CATEGORY_BASE_TAGS.get(category, []))

    # איסוף טקסט לניתוח
    combined = " ".join(filter(None, [
        row.get("title_he") or "",
        row.get("description") or "",
        (row.get("eligibility_conditions") or "")
        if isinstance(row.get("eligibility_conditions"), str)
        else " ".join(row.get("eligibility_conditions") or []),
    ])).lower()

    detected = set(base_tags)
    for population, keywords in POPULATION_KEYWORDS.items():
        if any(kw.lower() in combined for kw in keywords):
            detected.add(population)

    # אם זוהה גם discharged_soldier וגם reservist — שמור שניהם
    # אם זוהה רק אחד מהם — הוסף גם את השני (שני הקטגוריות קשורות)
    if "discharged_soldier" in detected or "reservist" in detected:
        detected.add("discharged_soldier")
        detected.add("reservist")

    if not detected:
        return ["general"]

    # סדר קבוע ועקבי
    order = [
        "general", "student", "discharged_soldier", "reservist",
        "single_parent", "senior_citizen", "new_immigrant", "disability",
        "has_car", "needs_movers", "with_family", "with_partner",
        "with_roommates", "alone",
    ]
    return [t for t in order if t in detected]


def supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_all_rows():
    endpoint = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    params = {
        "select": "id,category,title_he,description,eligibility_conditions,tags",
    }
    resp = requests.get(endpoint, headers=supabase_headers(), params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def update_row(row_id: int, new_tags: list[str]):
    endpoint = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    params = {"id": f"eq.{row_id}"}
    headers = {**supabase_headers(), "Prefer": "return=minimal"}
    resp = requests.patch(
        endpoint, headers=headers, params=params,
        json={"tags": new_tags}, timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"שגיאת עדכון (id={row_id}, status={resp.status_code}): {resp.text}")


def main():
    parser = argparse.ArgumentParser(description="מעדכן תגיות אוכלוסייה ב-rights_items")
    parser.add_argument("--dry-run", action="store_true", help="מציג מה ישתנה בלי לכתוב לדאטהבייס")
    args = parser.parse_args()

    missing = [n for n, v in [("SUPABASE_URL", SUPABASE_URL), ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY)] if not v]
    if missing:
        print(f"חסרים משתני סביבה: {', '.join(missing)}")
        sys.exit(1)

    print("שולף את כל השורות מהדאטהבייס...")
    rows = fetch_all_rows()
    print(f"נמצאו {len(rows)} שורות.\n")

    changed, unchanged, failed = 0, 0, 0

    for row in rows:
        try:
            old_tags = sorted(row.get("tags") or [])
            new_tags = detect_populations(row)
            title = (row.get("title_he") or "")[:55]
            cat = row.get("category") or ""

            if old_tags == sorted(new_tags):
                print(f"  ─ [{row['id']}] {cat} | {title[:40]} → ללא שינוי {new_tags}")
                unchanged += 1
            else:
                print(f"  ✓ [{row['id']}] {cat} | {title[:40]}")
                print(f"      לפני: {old_tags}")
                print(f"      אחרי: {new_tags}")
                if not args.dry_run:
                    update_row(row["id"], new_tags)
                changed += 1

        except Exception as e:
            print(f"  !! שגיאה בשורה {row.get('id')}: {e}")
            failed += 1

        if not args.dry_run:
            time.sleep(0.15)

    print("\n" + "=" * 55)
    if args.dry_run:
        print(f"[DRY RUN] {len(rows)} פריטים | {changed} ישתנו | {unchanged} ללא שינוי")
    else:
        print(f"סיכום: {changed} עודכנו | {unchanged} ללא שינוי | {failed} נכשלו")


if __name__ == "__main__":
    main()
