"""Round-2 verification tests: email-only brute-force keying + photographer role scope."""
import time

import requests

from conftest import API, login_session


class TestBruteForceEmailKeyed:
    def test_lockout_exactly_on_6th_via_public_url(self):
        s = requests.Session()
        email = f"TEST_lock_{int(time.time())}@twins.id"
        codes = []
        for _ in range(6):
            r = s.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=30)
            codes.append(r.status_code)
        assert codes[:5] == [401] * 5, codes
        assert codes[5] == 429, codes
        body = s.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=30).json()
        assert "Terlalu banyak percobaan" in body.get("detail", ""), body

    def test_owner_login_unaffected_by_other_email_lockout(self):
        s = requests.Session()
        email = f"TEST_lock2_{int(time.time())}@twins.id"
        for _ in range(6):
            s.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=30)
        owner = login_session("Owner (Pemilik Studio)")
        me = owner.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["role"] == "owner"


class TestPhotographerScope:
    def test_photographer_dashboard_forbidden_but_schedule_ok(self):
        s = login_session("Fotografer")
        assert s.get(f"{API}/dashboard/stats", timeout=30).status_code == 403
        r = s.get(f"{API}/bookings", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert s.get(f"{API}/notifications", timeout=30).status_code in (200, 403)


class TestPortalPhotosFlow:
    def test_add_photo_and_portal_visible(self):
        owner = login_session("Owner (Pemilik Studio)")
        created = owner.post(f"{API}/bookings", json={
            "client_name": "TEST_R2 Portal", "phone": "08990000001", "package": "Paket Gold",
            "booking_date": "2030-01-01", "booking_time": "09:00", "location": "Studio",
            "total_price": 4000000, "dp_amount": 2000000}, timeout=30)
        assert created.status_code in (200, 201), created.text
        target = created.json()
        bid = target["id"]
        r = owner.post(f"{API}/bookings/{bid}/photos",
                       json={"urls": ["https://picsum.photos/seed/TEST_r2/600/400"]}, timeout=30)
        assert r.status_code in (200, 201), r.text
        token = target.get("portal_token")
        assert token
        p = requests.get(f"{API}/portal/{token}", timeout=30)
        assert p.status_code == 200
        data = p.json()
        photos = data["booking"].get("photos", [])
        assert any("TEST_r2" in ph.get("url", "") for ph in photos), photos
        assert "_id" not in data["booking"]
