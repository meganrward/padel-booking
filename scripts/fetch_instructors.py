#!/usr/bin/env python3
"""One-off bootstrap: crawl the current schedule and scrape distinct instructor
names into instructors.json, to seed the admin UI's instructor dropdown.

Not run automatically — rerun manually later if the roster changes:
    python3 scripts/fetch_instructors.py
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from check_padel import (
    SCRIPT_DIR,
    get_available_weeks,
    get_activities_for_week,
    is_target_activity,
    fetch_detail_html,
    get_instructor_from_html,
    get_slot_id,
)


def main():
    names = set()
    weeks = get_available_weeks()
    seen_slots = set()

    for week in weeks:
        activities = get_activities_for_week(week["NumeroSemana"], week["Anyo"])
        for activity in activities:
            if not is_target_activity(activity.get("Actividad", "")):
                continue
            slot_id = get_slot_id(activity)
            if slot_id in seen_slots:
                continue
            seen_slots.add(slot_id)

            link = activity.get("Link", "")
            if not link:
                continue
            html = fetch_detail_html(link)
            instructor = get_instructor_from_html(html)
            if instructor:
                names.add(" ".join(instructor.split()).lower())
            time.sleep(0.2)

    result = sorted(names)
    out_path = os.path.join(SCRIPT_DIR, "instructors.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")

    print(f"Wrote {len(result)} instructor(s) to {out_path}")
    for name in result:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
