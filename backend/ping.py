"""
Run this first. Confirms your Gemini API key and free-tier quota actually work
before you build anything on top of it.

Usage: python ping.py
"""

import os

from dotenv import load_dotenv
from google import genai

load_dotenv()


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set. Copy .env.example to .env and add your key.")
        return

    client = genai.Client(api_key=api_key)
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    response = client.models.generate_content(
        model=model_name,
        contents="Reply with exactly one word: pong",
    )
    print(f"Model: {model_name}")
    print(f"Response: {response.text.strip()}")


if __name__ == "__main__":
    main()
