"""Auth module tests: login, cookies, me/refresh/logout, brute-force lockout, role gates."""
import re
import time
import requests
import pytest
from conftest import API, _creds, login_session


class TestHealthAndAuth:
    def test_health(self, anon):
        r = anon.get(f"{API}/health", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_owner_sets_httponly_cookies(self, anon):
        creds = _creds("Owner (Pemilik Studio)")
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=creds, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["email"] == creds["email"]
        assert data["role"] == "owner"
        assert "password_hash" not in data
        raw = r.headers.get("set-cookie", "")
        assert "access_token" in raw and "refresh_token" in raw
        assert "HttpOnly" in raw and "Secure" in raw
        assert re.search(r"samesite=none", raw, re.I)
        assert "access_token" in s.cookies

    def test_login_wrong_password_401(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": _creds("Admin")["email"], "password": "WrongPass!123"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self, anon):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_and_refresh_and_logout(self):
        s = login_session("Admin")
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["role"] == "admin"
        rf = s.post(f"{API}/auth/refresh", timeout=30)
        assert rf.status_code == 200
        lo = s.post(f"{API}/auth/logout", timeout=30)
        assert lo.status_code == 200

    def test_brute_force_lockout_after_5_fails_local(self):
        """Lockout after 5 failed attempts (direct backend). Key is email-only (round-2 fix)."""
        s = requests.Session()
        email = f"TEST_bruteforce_{int(time.time())}@example.com"
        codes = []
        for _ in range(6):
            r = s.post("http://localhost:8001/api/auth/login", json={"email": email, "password": "x"}, timeout=30)
            codes.append(r.status_code)
        assert codes[:5] == [401] * 5, codes
        assert codes[5] == 429, f"Expected 429 lockout on 6th attempt, got {codes}"

    def test_brute_force_lockout_via_public_ingress(self):
        s = requests.Session()
        email = f"TEST_bruteforce_pub_{int(time.time())}@example.com"
        codes = []
        for _ in range(8):
            r = s.post(f"{API}/auth/login", json={"email": email, "password": "x"}, timeout=30)
            codes.append(r.status_code)
        assert 429 in codes, f"No lockout through public ingress after 8 failed attempts: {codes}"

    def test_bcrypt_hash_format(self):
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio, os
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")

        async def check():
            cli = AsyncIOMotorClient(env["MONGO_URL"])
            u = await cli[env["DB_NAME"]].users.find_one({"email": _creds("Owner (Pemilik Studio)")["email"]})
            cli.close()
            return u

        u = asyncio.get_event_loop().run_until_complete(check()) if False else asyncio.run(check())
        assert u is not None
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]


class TestRoleAccess:
    def test_finance_unauthenticated_401(self):
        r = requests.get(f"{API}/finance/summary", timeout=30)
        assert r.status_code == 401

    def test_finance_admin_403(self, admin):
        r = admin.get(f"{API}/finance/summary", timeout=30)
        assert r.status_code == 403

    def test_finance_owner_200(self, owner):
        r = owner.get(f"{API}/finance/summary", timeout=30)
        assert r.status_code == 200

    @pytest.mark.parametrize("path", ["/users", "/expenses", "/analytics"])
    def test_owner_only_endpoints_forbidden_for_admin(self, admin, path):
        r = admin.get(f"{API}{path}", timeout=30)
        assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_photographer_cannot_access_dashboard_stats(self, photographer):
        r = photographer.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 403

    def test_photographer_sees_only_assigned_bookings(self, photographer):
        me = photographer.get(f"{API}/auth/me", timeout=30).json()
        r = photographer.get(f"{API}/bookings", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert all(b.get("photographer_id") == me["id"] for b in items), "Photographer sees unassigned bookings"

    def test_photographer_cannot_create_booking(self, photographer):
        r = photographer.post(f"{API}/bookings", json={
            "client_name": "TEST_x", "phone": "0800", "package": "P", "booking_date": "2026-08-01",
            "booking_time": "10:00", "location": "L", "total_price": 100000,
        }, timeout=30)
        assert r.status_code == 403
