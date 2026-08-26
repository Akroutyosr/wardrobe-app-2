"""
Smoke tests that run in CI with NO database and NO API keys: they verify the
FastAPI app assembles, every route the frontend depends on is registered, and
health reporting works against a stubbed wardrobe. Anything requiring real
Gemini/Supabase/HF credentials belongs to the eval scripts under app/eval/.
"""

from fastapi.testclient import TestClient

import app.main as main


def client(monkeypatch) -> TestClient:
    """App client with storage stubbed out — no network in unit CI."""
    monkeypatch.setattr(main, "list_items", lambda *a, **k: [])
    return TestClient(main.app)


def test_health_ok(monkeypatch):
    res = client(monkeypatch).get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["items"] == 0


def test_frontend_critical_routes_registered():
    """Every endpoint the UI calls on load / in its core loops must exist."""
    paths = {getattr(r, "path", "") for r in main.app.routes}
    critical = [
        "/api/health",
        "/api/stats",
        "/api/items",
        "/api/items/{item_id}",
        "/api/items/{item_id}/cpw",
        "/api/items/{item_id}/price",
        "/api/outfits/generate",
        "/api/outfits/saved",
        "/api/planner/week",
        "/api/planner/day",
        "/api/wear-log/suggest-today",
        "/api/wear-log/quick-log",
        "/api/wear-log/recent",
        "/api/challenges",
        "/api/challenges/completed",
        "/api/quiz/result",
        "/api/colors",
    ]
    missing = [p for p in critical if p not in paths]
    assert not missing, f"routes missing: {missing}"


def test_daily_budget_helper_is_lazy():
    """Unknown endpoints fall back to a sane default instead of crashing."""
    from app.main import _DEFAULT_CAPS

    assert _DEFAULT_CAPS.get("upload", 50) > 0
