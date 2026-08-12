"""
Calls IDM-VTON via Hugging Face Spaces (gradio_client) -- free, no API key,
but a shared community resource, so this includes a fallback mirror and
timeout handling rather than assuming the primary Space is always up.
"""

from pathlib import Path

from gradio_client import Client, handle_file

# Ordered by preference -- tries each in turn if the previous fails/times out.
SPACE_CANDIDATES = [
    "yisol/IDM-VTON",
    "kadirnar/IDM-VTON",
]

_client = None
_active_space = None
_space_index = 0


def _get_client() -> Client:
    global _client, _active_space, _space_index
    if _client is not None:
        return _client
    last_error = None
    for _ in range(len(SPACE_CANDIDATES)):
        space = SPACE_CANDIDATES[_space_index % len(SPACE_CANDIDATES)]
        _space_index += 1
        try:
            _client = Client(space)
            _active_space = space
            return _client
        except Exception as e:
            last_error = e
            continue
    raise RuntimeError(f"All IDM-VTON mirrors unavailable: {last_error}")


def try_on(person_image_path: Path, garment_image_path: Path, garment_description: str) -> Path:
    """Runs one try-on pass. Returns the path to the result image.

    Tries each mirror in turn: a Space can be reachable yet fail on the actual
    inference (queue backlog, read timeouts), so a failed predict also advances
    to the next candidate instead of assuming the first healthy client works.
    """
    last_error = None
    for _ in range(len(SPACE_CANDIDATES)):
        client = _get_client()
        try:
            result = client.predict(
                dict(background=handle_file(str(person_image_path)), layers=[], composite=None),
                handle_file(str(garment_image_path)),
                garment_description,
                True,
                True,
                30,
                42,
                api_name="/tryon",
            )
            # gradio_client returns a local temp file path for the output image
            out = Path(result[0] if isinstance(result, (list, tuple)) else result)
            if out.exists() and out.stat().st_size > 0:
                return out
            raise RuntimeError("empty result from try-on")
        except Exception as e:
            # Reset the cached client so the next _get_client() advances mirrors
            global _client
            _client = None
            last_error = f"Try-on failed via {_active_space}: {e}"
    raise RuntimeError(last_error)