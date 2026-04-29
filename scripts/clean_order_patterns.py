from collections import Counter
from csv import DictReader, DictWriter
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
INPUT_FILE = ROOT_DIR / "data" / "archive" / "original_data.csv"
OUTPUT_FILE = ROOT_DIR / "data" / "starbucks_orders_by_region_day_hour.csv"

DAY_NAMES = {
    "Mon": "Monday",
    "Tue": "Tuesday",
    "Wed": "Wednesday",
    "Thu": "Thursday",
    "Fri": "Friday",
    "Sat": "Saturday",
    "Sun": "Sunday",
}
DAY_ORDER = list(DAY_NAMES)
HOURS = range(24)
LOCALES = ("Urban", "Suburban")


def get_hour(order_time):
    """Return the hour as a 0-23 integer from times like HH:MM or 7:45pm."""
    cleaned_time = order_time.strip().lower()
    hour = int(cleaned_time.split(":", 1)[0])

    if cleaned_time.endswith("pm") and hour != 12:
        return hour + 12
    if cleaned_time.endswith("am") and hour == 12:
        return 0
    return hour


def clean_and_aggregate(input_file=INPUT_FILE, output_file=OUTPUT_FILE):
    orders_by_slot = Counter()
    regions = set()

    with input_file.open(newline="") as file:
        reader = DictReader(file)

        for row in reader:
            locale = row["store_location_type"].strip()
            if locale not in LOCALES:
                continue

            region = row["region"].strip()
            day = row["day_of_week"].strip()
            hour = get_hour(row["order_time"].strip())

            regions.add(region)
            orders_by_slot[(region, locale, day, hour)] += 1

    output_rows = []
    for region in sorted(regions):
        for locale in LOCALES:
            for day in DAY_ORDER:
                for hour in HOURS:
                    output_rows.append(
                        {
                            "locale": locale,
                            "region": region,
                            "day": DAY_NAMES[day],
                            "hour": hour,
                            "average_orders": orders_by_slot[(region, locale, day, hour)],
                        }
                    )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", newline="") as file:
        fieldnames = ["locale", "region", "day", "hour", "average_orders"]
        writer = DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    return len(output_rows)


if __name__ == "__main__":
    row_count = clean_and_aggregate()
    print(f"Wrote {row_count} rows to {OUTPUT_FILE}")
