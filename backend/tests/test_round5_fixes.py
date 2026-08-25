"""Round 5 verification tests: 404 guards on photo endpoints + notification cascade on booking delete."""
import pytest
from conftest import API


def _create_booking(sess, name="TEST_R5 Klien"):
    payload = {
        "client_name": name,
        "phone": "081200000005",
        "instagram": "@test_r5",
        "package": "Paket Test R5",
        "booking_date": "2026-12-30",
        "booking_time": "10:00",
        "location": "Studio TEST_R5",
        "total_price": 1500000,
        "dp_amount": 300000,
        "payment_method": "Transfer Bank",
        "notes": "TEST_R5",
        "photo_quota": 10,
    }
    r = sess.post(f"{API}/bookings", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"create booking failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert data.get("id")
    return data


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(owner, created_ids):
    yield
    for bid in created_ids:
        owner.delete(f"{API}/bookings/{bid}", timeout=30)


# --- Fix 1: POST /api/bookings/{id}/photos with unknown booking -> 404
class TestAddPhotosUnknownBooking:
    def test_add_photos_unknown_booking_returns_404(self, owner):
        r = owner.post(f"{API}/bookings/nonexistent-id-r5/photos",
                       json={"urls": ["foto_001.jpg"]}, timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:300]}"
        assert "Booking tidak ditemukan" in r.text

    def test_add_photos_empty_still_400(self, owner):
        r = owner.post(f"{API}/bookings/nonexistent-id-r5/photos",
                       json={"urls": ["  "]}, timeout=30)
        assert r.status_code == 400

    def test_add_photos_valid_booking_still_works(self, owner, created_ids):
        b = _create_booking(owner)
        created_ids.append(b["id"])
        r = owner.post(f"{API}/bookings/{b['id']}/photos",
                       json={"urls": ["foto_A.jpg", "https://x.test/p/foto_B.jpg"]}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        photos = r.json()
        assert len(photos) == 2
        assert photos[0]["label"] == "foto_A.jpg" and photos[0]["url"] == ""
        assert photos[1]["url"] == "https://x.test/p/foto_B.jpg"
        # verify persistence
        g = owner.get(f"{API}/bookings/{b['id']}", timeout=30)
        assert g.status_code == 200
        assert len(g.json()["photos"]) == 2


# --- Fix 3: DELETE photo 404s
class TestDeletePhoto404:
    def test_delete_photo_unknown_booking_404(self, owner):
        r = owner.delete(f"{API}/bookings/nonexistent-id-r5/photos/nonexistent-photo", timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:300]}"
        assert "Booking tidak ditemukan" in r.text

    def test_delete_unknown_photo_existing_booking_404(self, owner, created_ids):
        b = _create_booking(owner, "TEST_R5 DelFoto")
        created_ids.append(b["id"])
        owner.post(f"{API}/bookings/{b['id']}/photos", json={"urls": ["foto_keep.jpg"]}, timeout=30)
        r = owner.delete(f"{API}/bookings/{b['id']}/photos/does-not-exist", timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:300]}"
        assert "Foto tidak ditemukan" in r.text

    def test_delete_existing_photo_ok_and_persisted(self, owner, created_ids):
        b = _create_booking(owner, "TEST_R5 DelFotoOK")
        created_ids.append(b["id"])
        pr = owner.post(f"{API}/bookings/{b['id']}/photos",
                        json={"urls": ["foto_x.jpg", "foto_y.jpg"]}, timeout=30)
        photos = pr.json()
        pid = photos[0]["id"]
        r = owner.delete(f"{API}/bookings/{b['id']}/photos/{pid}", timeout=30)
        assert r.status_code == 200 and r.json().get("ok") is True
        g = owner.get(f"{API}/bookings/{b['id']}", timeout=30)
        remaining = [p["id"] for p in g.json()["photos"]]
        assert pid not in remaining and len(remaining) == 1
        # deleting again -> 404 Foto tidak ditemukan
        r2 = owner.delete(f"{API}/bookings/{b['id']}/photos/{pid}", timeout=30)
        assert r2.status_code == 404 and "Foto tidak ditemukan" in r2.text


# --- Fix 2: DELETE booking cascades notifications
class TestDeleteBookingCascadesNotifications:
    def test_notifications_deleted_with_booking(self, owner):
        b = _create_booking(owner, "TEST_R5 Cascade")
        bid = b["id"]
        # trigger notification(s): invoice send + payment
        sent = owner.post(f"{API}/bookings/{bid}/invoice/send", timeout=60)
        pay = owner.post(f"{API}/bookings/{bid}/payments",
                         json={"amount": 500000, "method": "transfer", "note": "TEST_R5"}, timeout=30)
        notes = owner.get(f"{API}/notifications", timeout=30)
        assert notes.status_code == 200
        mine = [n for n in notes.json() if n.get("booking_id") == bid]
        assert len(mine) > 0, (
            f"no notification created for booking (send-invoice={sent.status_code}, "
            f"payment={pay.status_code}) - cannot verify cascade")

        d = owner.delete(f"{API}/bookings/{bid}", timeout=30)
        assert d.status_code == 200, d.text[:300]

        after = owner.get(f"{API}/notifications", timeout=30)
        orphans = [n for n in after.json() if n.get("booking_id") == bid]
        assert orphans == [], f"orphaned notifications remain after delete: {orphans}"
        # payments cascade too
        assert owner.get(f"{API}/bookings/{bid}", timeout=30).status_code == 404
