"""
Lists every model your API key currently has access to. Run this once
whenever a model name stops working -- it tells you the exact current
ID string instead of guessing from docs that may be stale.
"""

import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

for model in client.models.list():
    if "generateContent" in model.supported_actions:
        print(model.name)