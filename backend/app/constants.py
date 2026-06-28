"""Shared constants: the fixed statuses (spec §5) and Hebrew category labels.

Keep STATUSES in sync with the CHECK constraint in
supabase/migrations/0002_user_tracking.sql.
"""

# The 7 allowed statuses, in display order. Do not invent new ones (spec §5, §8).
STATUSES: list[str] = [
    "לא התחיל",
    "בבדיקה",
    "בטיפול",
    "הושלם",
    "לא רלוונטי",
    "דורש בדיקה",
    "ממתין לגורם חיצוני",
]

DEFAULT_STATUS = "לא התחיל"
DONE_STATUS = "הושלם"

ITEM_TYPES = ("moving_task", "rights_item", "custom_task")

# Hebrew labels for the category slugs found in rights_items, plus "other"
# kept for old custom_task rows created before CUSTOM_TASK_CATEGORIES switched
# to free Hebrew text. (moving_tasks.category is itself free Hebrew text, not
# a slug — see CUSTOM_TASK_CATEGORIES below — so it needs no lookup here.)
CATEGORY_LABELS: dict[str, str] = {
    "other": "כללי",
    "rights_general": "זכויות כלליות",
    "arnona_general": "ארנונה",
    "arnona_discount": "הנחות בארנונה",
    "parking_permit": "תו חניה אזורי",
    "senior_benefits": "הטבות לאזרחים ותיקים",
    "address_update": "עדכון כתובת",
}


def category_label(slug: str | None) -> str:
    if not slug:
        return "כללי"
    return CATEGORY_LABELS.get(slug, slug)


# moving_tasks.category is free Hebrew text scraped from the source guide
# (not a slug), so this is the actual, current set of values used there —
# verified directly against the live data, not the aspirational English-slug
# list above (which only matches rights_items). Custom tasks use this same
# vocabulary so they group together with the matching moving_tasks category
# in the Dashboard instead of creating a separate, disconnected bucket.
# "אחר" is the catch-all when nothing else genuinely fits.
CUSTOM_TASK_CATEGORIES: list[str] = [
    "אריזה והובלה",
    "בירוקרטיה כללית",
    "בירוקרטיה ממשלתית",
    "בירוקרטיה של עיריות",
    "הכנת הבית החדש",
    "חינוך",
    "לוגיסטיקות",
    "פינוי דירה ישנה",
    "רכב",
    "שירותים חשובים",
    "אחר",
]
