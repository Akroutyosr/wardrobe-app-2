"""
Orchestrates the shopping decision agent: gives the model the available
tools and lets IT decide which to call and in what order, rather than
hardcoding a fixed pipeline. That's what makes this an agent rather than
a fixed sequence of function calls.

Deliberately manual (not the SDK's automatic function-calling helper) so
we control the iteration cap and can log every tool call during
development -- both called out in the project plan as safety rails.
"""

import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.agent.tools import TOOL_DECLARATIONS, TOOL_DISPATCH

load_dotenv()

MAX_TOOL_CALLS = 6

SYSTEM_INSTRUCTION = """You are a shopping decision assistant for a personal
wardrobe app. The user is considering buying a new item and has given you
a photo of it.

You MUST call all three of these tools before giving your final verdict,
even if you feel confident with less information after only one or two:
1. tag_new_item -- tag the new item.
2. check_duplicates -- check whether they already own something similar.
3. compute_versatility_score -- score how versatile it is with their wardrobe.

Do not skip any of these three, even for a case that seems obvious early on.
You may also optionally use query_wardrobe if you need more context on
specific categories to reason well.

IMPORTANT: When your final answer references how many similar/duplicate
items exist, or how many items it pairs with, you MUST use the exact
count from the tool results (the length of the "duplicates" list from
check_duplicates, or the "versatility_score" number) -- never estimate,
round, or guess a count from memory. If check_duplicates returned exactly
one duplicate, say "one" or name that single item, not "a couple" or "two."

COST-PER-WEAR GUIDANCE: If the user provides a price for the new item,
include a cost-per-wear projection in your verdict using this format:
"At [price], if you wear it [N] times per year (based on its versatility
score of [score]), that works out to approximately [price/N]/wear."
Use the versatility_score divided by 10 as a conservative estimated
annual wear count (e.g. versatility_score=35 -> estimate 3-4 wears/year).
Compare this to the user's wardrobe average if one was provided.

Give a final verdict: your response MUST begin with exactly one of
"Verdict: buy", "Verdict: skip", or "Verdict: maybe" as the first line,
followed by a short, warm, plain-language justification that references
specific existing items it pairs with (by category/subcategory, not
internal ids) and any duplicate or gap findings.

Decide the order yourself, and do not call a tool more than once with the
same arguments. When you have called all three required tools and have
enough information, respond with your final verdict as plain text (not a
tool call).
"""


def _build_tool() -> types.Tool:
    declarations = [
        types.FunctionDeclaration(
            name=t["name"], description=t["description"], parameters=t["parameters"]
        )
        for t in TOOL_DECLARATIONS
    ]
    return types.Tool(function_declarations=declarations)


def evaluate_purchase(
    image_path: str, verbose: bool = True, extra_context: str = ""
) -> tuple[str, list[dict]]:
    """
    Runs the full agent loop for a prospective purchase photo.
    Returns (final verdict text, list of {name, args, result} for every tool call made) --
    the tool log lets you cross-check the verdict's claims against real numbers.
    extra_context is appended to the opening prompt (e.g. price + wardrobe
    average cost-per-wear) so the verdict can reason with it.
    """
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    model_name = os.environ.get("GEMINI_MODEL", "models/gemini-3.1-flash-lite")
    tool = _build_tool()
    tool_log = []

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(
                text=f"{SYSTEM_INSTRUCTION}\n\nThe photo is at: {image_path}{extra_context}"
            )],
        )
    ]

    for call_count in range(1, MAX_TOOL_CALLS + 1):
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(tools=[tool]),
        )

        candidate = response.candidates[0]
        function_calls = [
            part.function_call for part in candidate.content.parts if part.function_call
        ]

        if not function_calls:
            final_text = "".join(
                part.text for part in candidate.content.parts if part.text
            )
            return final_text, tool_log

        # Append the model's turn (including its function call requests)
        contents.append(candidate.content)

        # Execute each requested tool call and feed results back
        response_parts = []
        for fc in function_calls:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}

            if verbose:
                print(f"[tool call {call_count}] {tool_name}({tool_args})")

            if tool_name not in TOOL_DISPATCH:
                result = {"error": f"unknown tool {tool_name}"}
            else:
                try:
                    result = TOOL_DISPATCH[tool_name](tool_args)
                except Exception as e:
                    result = {"error": str(e)}

            tool_log.append({"name": tool_name, "args": tool_args, "result": result})
            response_parts.append(
                types.Part.from_function_response(name=tool_name, response={"result": result})
            )

        contents.append(types.Content(role="user", parts=response_parts))

    return (
        "Reached the maximum number of reasoning steps without a final answer.",
        tool_log,
    )
