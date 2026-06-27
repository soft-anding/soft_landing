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

# Hebrew labels for the category slugs found in moving_tasks / rights_items.
CATEGORY_LABELS: dict[str, str] = {
    # moving_tasks
    "government_registry": "ממשל וכתובת רשמית",
    "municipal": "עיריית תל אביב-יפו",
    "utilities": "חשבונות וספקי שירות",
    "communication_services": "תקשורת: אינטרנט וטלוויזיה",
    "financial": "כספים ותשלומים",
    "logistics": "לוגיסטיקה ומעבר",
    "household_setup": "סידור הבית",
    "education": "חינוך",
    "other": "כללי",
    # rights_items
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
