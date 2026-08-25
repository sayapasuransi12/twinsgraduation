"""Round 4: booking deletion + photo label (filename) selection flow."""
import pytest
from conftest import API

BOOKING_PAYLOAD = {
    "client_name": "TEST_R4 Klien",
    "phone": "081200000004",
    "instagram": "@test_r4",
    "package": "Paket Test R4",
    "booking_date": "2026-12-20",
    "booking_time": "10:00",
    "location": "Studio Test",
    "total_price": 1000000,
    "dp_amount": 300000,
    "payment_method": "Transfer Bank",
    "notes": "round4 test",
    "photo_quota": 10,
}


def create_booking(session):
    r = session.post(f"{API}/bookings", json=BOOKING_PAYLOAD, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def booking(owner):
    b = create_booking(owner)
    yield b
    owner.delete(f"{API}/bookings/{b['id']}", timeout=30)


# --- Feature: DELETE /api/bookings/{id} ---
class TestDeleteBooking:
    def test_delete_booking_removes_payments(self, owner):
        b = create_booking(owner)
        bid = b["id"]
        pay = owner.post(f"{API}/bookings/{bid}/payments", json={"amount": 300000, "method": "Transfer Bank", "type": "dp"}, timeout=30)
        assert pay.status_code == 200, pay.text

        detail = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert len(detail["payments"]) == 1
        assert detail["paid_amount"] == 300000

        d = owner.delete(f"{API}/bookings/{bid}", timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("ok") is True

        assert owner.get(f"{API}/bookings/{bid}", timeout=30).status_code == 404
        # payments gone: no way to query directly, verify via listing not containing invoice
        lst = owner.get(f"{API}/bookings", params={"search": b["invoice_number"]}, timeout=30).json()
        assert lst == []

    def test_delete_booking_as_admin(self, admin):
        b = create_booking(admin)
        d = admin.delete(f"{API}/bookings/{b['id']}", timeout=30)
        assert d.status_code == 200
        assert admin.get(f"{API}/bookings/{b['id']}", timeout=30).status_code == 404

    def test_delete_booking_photographer_forbidden(self, owner, photographer):
        b = create_booking(owner)
        try:
            r = photographer.delete(f"{API}/bookings/{b['id']}", timeout=30)
            assert r.status_code == 403, r.text
            assert owner.get(f"{API}/bookings/{b['id']}", timeout=30).status_code == 200
        finally:
            owner.delete(f"{API}/bookings/{b['id']}", timeout=30)

    def test_delete_booking_anon_unauthorized(self, owner, anon):
        b = create_booking(owner)
        try:
            r = anon.delete(f"{API}/bookings/{b['id']}", timeout=30)
            assert r.status_code in (401, 403), r.text
        finally:
            owner.delete(f"{API}/bookings/{b['id']}", timeout=30)

    def test_delete_nonexistent_booking_404(self, owner):
        r = owner.delete(f"{API}/bookings/does-not-exist-xyz", timeout=30)
        assert r.status_code == 404


# --- Feature: photo labels (filenames) ---
class TestPhotoLabels:
    def test_add_label_and_url_photos(self, owner, booking):
        bid = booking["id"]
        r = owner.post(f"{API}/bookings/{bid}/photos", json={
            "urls": ["DSC06265.JPG", "DSC06266.JPG", "https://picsum.photos/seed/x/600/400"]
        }, timeout=30)
        assert r.status_code == 200, r.text
        photos = r.json()
        assert len(photos) == 3
        assert photos[0]["url"] == "" and photos[0]["label"] == "DSC06265.JPG"
        assert photos[1]["url"] == "" and photos[1]["label"] == "DSC06266.JPG"
        assert photos[2]["url"].startswith("http") and photos[2]["label"] == "400"
        assert all(p["selected"] is False for p in photos)
        assert all(isinstance(p["id"], str) and p["id"] for p in photos)

        # persistence
        detail = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert len(detail["photos"]) == 3
        assert detail["photos"][0]["label"] == "DSC06265.JPG"

    def test_add_photos_empty_list_400(self, owner, booking):
        r = owner.post(f"{API}/bookings/{booking['id']}/photos", json={"urls": ["", "  "]}, timeout=30)
        assert r.status_code == 400

    def test_add_photos_photographer_forbidden(self, photographer, booking):
        r = photographer.post(f"{API}/bookings/{booking['id']}/photos", json={"urls": ["A.JPG"]}, timeout=30)
        assert r.status_code == 403

    def test_add_photos_unknown_booking(self, owner):
        r = owner.post(f"{API}/bookings/unknown-booking-id/photos", json={"urls": ["A.JPG"]}, timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"

    def test_delete_photo(self, owner, booking):
        bid = booking["id"]
        photos = owner.post(f"{API}/bookings/{bid}/photos", json={"urls": ["DEL1.JPG", "DEL2.JPG"]}, timeout=30).json()
        pid = photos[0]["id"]
        r = owner.delete(f"{API}/bookings/{bid}/photos/{pid}", timeout=30)
        assert r.status_code == 200
        detail = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert [p["id"] for p in detail["photos"]] == [photos[1]["id"]]


def bid_of(b):
    return b["id"]


# --- Feature: portal manual photo + selection ---
class TestPortalManualSelection:
    def test_portal_label_selection_and_manual_add(self, owner, anon, booking):
        bid, token = booking["id"], booking["portal_token"]
        photos = owner.post(f"{API}/bookings/{bid}/photos", json={"urls": ["DSC06265.JPG", "DSC06266.JPG"]}, timeout=30).json()

        pv = anon.get(f"{API}/portal/{token}", timeout=30)
        assert pv.status_code == 200
        data = pv.json()
        assert data["selected_count"] == 0
        assert len(data["booking"]["photos"]) == 2

        # toggle select first
        r = anon.post(f"{API}/portal/{token}/photos/{photos[0]['id']}", json={"selected": True, "note": "bagus"}, timeout=30)
        assert r.status_code == 200
        data = anon.get(f"{API}/portal/{token}", timeout=30).json()
        assert data["selected_count"] == 1
        assert data["booking"]["photos"][0]["note"] == "bagus"

        # deselect
        assert anon.post(f"{API}/portal/{token}/photos/{photos[0]['id']}", json={"selected": False}, timeout=30).status_code == 200
        assert anon.get(f"{API}/portal/{token}", timeout=30).json()["selected_count"] == 0

        # manual add -> pre-selected
        m = anon.post(f"{API}/portal/{token}/photos/manual", json={"label": "DSC06300.JPG"}, timeout=30)
        assert m.status_code == 200, m.text
        mp = m.json()
        assert mp["label"] == "DSC06300.JPG"
        assert mp["selected"] is True
        assert mp["url"] == ""
        data = anon.get(f"{API}/portal/{token}", timeout=30).json()
        assert data["selected_count"] == 1
        assert len(data["booking"]["photos"]) == 3

        # empty label rejected
        assert anon.post(f"{API}/portal/{token}/photos/manual", json={"label": "   "}, timeout=30).status_code == 400

        # unknown photo id
        assert anon.post(f"{API}/portal/{token}/photos/nope", json={"selected": True}, timeout=30).status_code == 404

        # submit selection
        s = anon.post(f"{API}/portal/{token}/submit-selection", timeout=30)
        assert s.status_code == 200, s.text
        assert s.json()["selected"] == 1

        # blocked after submit
        assert anon.post(f"{API}/portal/{token}/photos/manual", json={"label": "X.JPG"}, timeout=30).status_code == 400
        assert anon.post(f"{API}/portal/{token}/photos/{photos[1]['id']}", json={"selected": True}, timeout=30).status_code == 400
        assert anon.post(f"{API}/portal/{token}/submit-selection", timeout=30).status_code == 400

        # admin side reflects
        detail = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert detail["selection_submitted"] is True
        assert detail["editing_status"] == "antre_edit"
        assert sum(1 for p in detail["photos"] if p["selected"]) == 1

    def test_submit_without_selection_400(self, anon, booking):
        r = anon.post(f"{API}/portal/{booking['portal_token']}/submit-selection", timeout=30)
        assert r.status_code == 400

    def test_portal_invalid_token_404(self, anon):
        assert anon.get(f"{API}/portal/invalidtoken123", timeout=30).status_code == 404
        assert anon.post(f"{API}/portal/invalidtoken123/photos/manual", json={"label": "A"}, timeout=30).status_code == 404


# --- Public booking form regression ---
class TestPublicBooking:
    def test_public_create_and_cleanup(self, owner, anon):
        r = anon.post(f"{API}/public/bookings", json={**BOOKING_PAYLOAD, "client_name": "TEST_R4 Public"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["invoice_number"].startswith("INV-")
        assert len(d["portal_token"]) == 24
        try:
            got = owner.get(f"{API}/bookings/{d['id']}", timeout=30)
            assert got.status_code == 200
            assert got.json()["client_name"] == "TEST_R4 Public"
        finally:
            assert owner.delete(f"{API}/bookings/{d['id']}", timeout=30).status_code == 200

    def test_public_packages(self, anon):
        r = anon.get(f"{API}/public/packages", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
