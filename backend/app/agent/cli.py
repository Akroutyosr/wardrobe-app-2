"""
Test the shopping decision agent end to end.

Usage:
    python -m app.agent.cli data/photos/some_prospective_item.jpg
"""

import sys

from app.agent.orchestrator import evaluate_purchase


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m app.agent.cli <path_to_photo>")
        sys.exit(1)

    image_path = sys.argv[1]
    print(f"Evaluating: {image_path}\n")

    verdict, tool_log = evaluate_purchase(image_path)

    print(f"\n--- Verdict ---\n{verdict}")

    print("\n--- Grounding data (cross-check the verdict text against these) ---")
    for entry in tool_log:
        print(f"  {entry['name']}: {entry['result']}")


if __name__ == "__main__":
    main()
