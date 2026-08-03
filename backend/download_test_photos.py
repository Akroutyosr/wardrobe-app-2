"""
Downloads a small batch of test clothing photos from Wikimedia Commons
(free, no API key needed) so you have something to run the tagging
pipeline against before using real photos of your own wardrobe.

This is for pipeline testing only -- swap in real photos of your own
clothes before building your eval set in Phase 1, since that's what the
accuracy numbers need to reflect.

Usage:
    python download_test_photos.py
"""

import time
from pathlib import Path

import requests

OUT_DIR = Path(__file__).resolve().parent / "data" / "photos"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEARCH_TERMS = [
    "blue t-shirt",
    "denim jeans",
    "white sneakers",
    "black leather jacket",
    "striped dress shirt",
    "wool sweater",
    "khaki chino pants",
    "floral summer dress",
    "grey hoodie",
    "brown leather boots",
    "navy blazer",
    "black trousers",
]

API_URL = "https://commons.wikimedia.org/w/api.php"
# Wikimedia asks for a descriptive User-Agent with contact info -- generic
# UAs get rate-limited harder. Replace the email with anything, real or not.
HEADERS = {"User-Agent": "wardrobe-app-personal-project/1.0 (contact: you@example.com)"}


def find_image_url(term: str) -> str | None:
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": term,          # plain search text, no filetype: qualifier
        "gsrnamespace": 6,          # restrict to the File: namespace
        "gsrlimit": 10,
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "format": "json",
    }
    resp = requests.get(API_URL, params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", {})

    for page in pages.values():
        imageinfo = page.get("imageinfo", [])
        if not imageinfo:
            continue
        mime = imageinfo[0].get("mime", "")
        if mime in ("image/jpeg", "image/png"):
            return imageinfo[0]["url"]
    return None


def download(url: str, dest: Path) -> None:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    dest.write_bytes(resp.content)


def main():
    for term in SEARCH_TERMS:
        safe_name = term.replace(" ", "_")
        dest = OUT_DIR / f"{safe_name}.jpg"
        if dest.exists():
            print(f"skip (already have): {dest.name}")
            continue

        for attempt in range(3):
            try:
                url = find_image_url(term)
                if not url:
                    print(f"no result for: {term}")
                    break
                download(url, dest)
                print(f"saved: {dest.name}")
                break
            except requests.HTTPError as e:
                if e.response is not None and e.response.status_code == 429:
                    wait = 5 * (attempt + 1)
                    print(f"rate limited on '{term}', waiting {wait}s...")
                    time.sleep(wait)
                    continue
                print(f"failed for '{term}': {e}")
                break
            except requests.RequestException as e:
                print(f"failed for '{term}': {e}")
                break

        time.sleep(2)  # more polite spacing between terms

    print(f"\nDone. Check {OUT_DIR} for downloaded photos.")


if __name__ == "__main__":
    main()