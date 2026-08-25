"""Bookings module: public booking creation, CRUD, filters, payments, invoice PDF, schedule, portal."""
import pytest
import requests
from conftest import API


def make_booking(session, name, total=2000000, dp=500000):
    r = session.post(f"{API}/bookings", json={
        "client_name": name, "phone": "081200000009", "package": "Paket Wisuda Solo",
        "booking_date": "2026-09-20", "booking_time": "16:00", "location": "Studio TEST",
        "total_price": total, "dp_amount": dp,
    }, timeout=30)
    assert r.status_code == 200, r.text[:300]
    return r.json()["id"]


@pytest.fixture(scope="class")
def created(owner):
    """Class-scoped booking ids (xdist loadscope keeps a class on one worker)."""
    return []


class TestPublicBooking:
    def test_public_packages(self, anon):
        r = anon.get(f"{API}/public/packages", timeout=30)
        assert r.status_code == 200
        pkgs = r.json()
        assert isinstance(pkgs, list) and len(pkgs) > 0
        assert "name" in pkgs[0] and "price" in pkgs[0]

    def test_public_create_booking_and_visible_in_admin(self, anon, owner, created):
        payload = {
            "client_name": "TEST_Publik Klien", "phone": "081200000001", "instagram": "@test_pub",
            "package": "Paket Wisuda Solo", "booking_date": "2026-09-15", "booking_time": "14:00",
            "location": "Kampus UGM", "total_price": 1500000, "dp_amount": 500000,
            "payment_method": "Transfer Bank", "notes": "TEST notes", "photo_quota": 20,
        }
        r = anon.post(f"{API}/public/bookings", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["invoice_number"].startswith("INV-")
        assert len(data["portal_token"]) == 24
        created.append(data["id"])

        got = owner.get(f"{API}/bookings/{data['id']}", timeout=30)
        assert got.status_code == 200
        b = got.json()
        assert b["client_name"] == payload["client_name"]
        assert b["total_price"] == 1500000
        assert b["remaining"] == 1500000
        assert b["paid_amount"] == 0
        assert b["payment_status"] == "belum"
        assert b["status"] == "pending"
        assert "_id" not in b

        lst = owner.get(f"{API}/bookings", params={"search": "TEST_Publik"}, timeout=30)
        assert lst.status_code == 200
        assert any(x["id"] == data["id"] for x in lst.json())

    def test_public_create_validation(self, anon):
        r = anon.post(f"{API}/public/bookings", json={"client_name": "x"}, timeout=30)
        assert r.status_code == 422


class TestBookingCrudAndFilters:
    def test_admin_create_and_update(self, owner, created):
        r = owner.post(f"{API}/bookings", json={
            "client_name": "TEST_Admin Booking", "phone": "081200000002", "package": "Paket Duo",
            "booking_date": "2026-09-16", "booking_time": "09:00", "location": "Studio",
            "total_price": 2000000, "dp_amount": 700000,
        }, timeout=30)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        created.append(b["id"])
        assert "_id" not in b

        up = owner.patch(f"{API}/bookings/{b['id']}", json={
            "status": "confirmed", "editing_status": "antre_edit", "delivery_status": "terkirim",
            "admin_notes": "TEST catatan internal", "drive_link": "https://drive.google.com/drive/folders/TEST",
        }, timeout=30)
        assert up.status_code == 200, up.text[:300]
        u = up.json()
        assert u["status"] == "confirmed"
        assert u["admin_notes"] == "TEST catatan internal"

        g = owner.get(f"{API}/bookings/{b['id']}", timeout=30).json()
        assert g["status"] == "confirmed"
        assert g["drive_link"].endswith("TEST")
        assert g["delivery_status"] == "terkirim"

    def test_invalid_status_rejected(self, owner, created):
        r = owner.patch(f"{API}/bookings/{created[0]}", json={"status": "not_a_status"}, timeout=30)
        assert r.status_code == 400

    def test_get_missing_booking_404(self, owner):
        r = owner.get(f"{API}/bookings/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_assign_photographer(self, owner, created):
        ph = owner.get(f"{API}/photographers", timeout=30)
        assert ph.status_code == 200
        photogs = ph.json()
        assert len(photogs) > 0
        r = owner.patch(f"{API}/bookings/{created[0]}", json={"photographer_id": photogs[0]["id"]}, timeout=30)
        assert r.status_code == 200
        assert r.json()["photographer_name"] == photogs[0]["name"]

    def test_filters(self, owner):
        r = owner.get(f"{API}/bookings", params={"status": "completed"}, timeout=30)
        assert r.status_code == 200
        assert all(b["status"] == "completed" for b in r.json())
        r2 = owner.get(f"{API}/bookings", params={"payment_status": "lunas"}, timeout=30)
        assert r2.status_code == 200
        assert all(b["payment_status"] == "lunas" for b in r2.json())
        r3 = owner.get(f"{API}/bookings", params={"date_from": "2026-01-01", "date_to": "2026-12-31"}, timeout=30)
        assert r3.status_code == 200
        assert all("2026-01-01" <= b["booking_date"] <= "2026-12-31" for b in r3.json())


class TestPayments:
    def test_add_payments_updates_totals_and_status(self, owner, created):
        bid = make_booking(owner, "TEST_Pembayaran Klien")
        created.append(bid)
        before = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        total = before["total_price"]

        p = owner.post(f"{API}/bookings/{bid}/payments", json={
            "amount": 500000, "method": "Transfer Bank", "type": "dp", "note": "TEST dp"}, timeout=30)
        assert p.status_code == 200, p.text[:300]
        assert p.json()["amount"] == 500000

        b = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert b["paid_amount"] == before["paid_amount"] + 500000
        assert b["remaining"] == max(total - b["paid_amount"], 0)
        assert b["payment_status"] == "dp"
        assert b["status"] == "dp_paid"
        assert len(b["payments"]) >= 1

        rest = total - b["paid_amount"]
        p2 = owner.post(f"{API}/bookings/{bid}/payments", json={
            "amount": rest, "method": "Cash", "type": "pelunasan"}, timeout=30)
        assert p2.status_code == 200
        b2 = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert b2["paid_amount"] == total
        assert b2["remaining"] == 0
        assert b2["payment_status"] == "lunas"
        assert b2["status"] == "fully_paid"

    def test_zero_payment_rejected(self, owner, created):
        bid = created[0] if created else make_booking(owner, "TEST_Zero Pay")
        r = owner.post(f"{API}/bookings/{bid}/payments", json={"amount": 0}, timeout=30)
        assert r.status_code == 400

    def test_payment_on_missing_booking(self, owner):
        r = owner.post(f"{API}/bookings/nope/payments", json={"amount": 1000}, timeout=30)
        assert r.status_code == 404

    def test_delete_payment_recomputes(self, owner, created):
        bid = make_booking(owner, "TEST_Hapus Pembayaran")
        created.append(bid)
        owner.post(f"{API}/bookings/{bid}/payments", json={"amount": 500000, "type": "dp"}, timeout=30)
        b = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        pay_id = b["payments"][0]["id"]
        d = owner.delete(f"{API}/bookings/{bid}/payments/{pay_id}", timeout=30)
        assert d.status_code == 200
        after = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert after["paid_amount"] == b["paid_amount"] - b["payments"][0]["amount"]
        assert after["payment_status"] != "lunas"

    def test_admin_cannot_delete_payment(self, admin, owner, created):
        bid = created[0] if created else make_booking(owner, "TEST_Admin Del")
        r = admin.delete(f"{API}/bookings/{bid}/payments/whatever", timeout=30)
        assert r.status_code == 403


class TestInvoice:
    def test_invoice_data_and_pdf(self, owner, created):
        bid = make_booking(owner, "TEST_Invoice Klien")
        created.append(bid)
        d = owner.get(f"{API}/bookings/{bid}/invoice", timeout=30)
        assert d.status_code == 200
        body = d.json()
        assert body["booking"]["id"] == bid
        assert body["business"]["name"]

        pdf = owner.get(f"{API}/bookings/{bid}/invoice.pdf", timeout=60)
        assert pdf.status_code == 200
        assert pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"
        assert len(pdf.content) > 1000

    def test_invoice_pdf_requires_auth(self, owner, created):
        bid = created[0] if created else make_booking(owner, "TEST_Invoice Auth")
        r = requests.get(f"{API}/bookings/{bid}/invoice.pdf", timeout=30)
        assert r.status_code == 401

    def test_send_invoice_creates_notification(self, owner, created):
        bid = created[0] if created else make_booking(owner, "TEST_Kirim Invoice")
        before = len(owner.get(f"{API}/notifications", timeout=30).json())
        r = owner.post(f"{API}/bookings/{bid}/invoice/send", timeout=30)
        assert r.status_code == 200
        after = owner.get(f"{API}/notifications", timeout=30).json()
        assert len(after) >= before + 1
        assert any(n["type"] == "invoice_terkirim" and n["booking_id"] == bid for n in after)
        b = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert b["invoice_sent_at"]


class TestScheduleConflicts:
    def test_schedule_returns_conflict_flags(self, owner):
        r = owner.get(f"{API}/schedule", params={"start": "2026-01-01", "end": "2026-12-31"}, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) > 0
        assert all("conflict" in d for d in docs)
        conflicted = [d for d in docs if d["conflict"]]
        assert len(conflicted) >= 2, "Expected seeded conflicting bookings (Eka Putri 09:00 / Gita 10:30)"

    def test_schedule_requires_auth(self):
        r = requests.get(f"{API}/schedule", params={"start": "2026-01-01", "end": "2026-12-31"}, timeout=30)
        assert r.status_code == 401


class TestPortalAndPhotos:
    def test_portal_flow_photos_and_submit(self, owner, anon, created):
        bid = make_booking(owner, "TEST_Portal Klien")
        created.append(bid)
        b = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        token = b["portal_token"]

        add = owner.post(f"{API}/bookings/{bid}/photos", json={"urls": [
            "https://images.unsplash.com/photo-1", "https://images.unsplash.com/photo-2"]}, timeout=30)
        assert add.status_code == 200
        photos = add.json()
        assert len(photos) == 2

        empty = owner.post(f"{API}/bookings/{bid}/photos", json={"urls": ["  "]}, timeout=30)
        assert empty.status_code == 400

        view = anon.get(f"{API}/portal/{token}", timeout=30)
        assert view.status_code == 200
        v = view.json()
        assert v["booking"]["invoice_number"] == b["invoice_number"]
        assert v["selected_count"] == 0
        assert "password_hash" not in str(v)

        pid = photos[0]["id"]
        sel = anon.post(f"{API}/portal/{token}/photos/{pid}", json={"selected": True, "note": "TEST pilih"}, timeout=30)
        assert sel.status_code == 200
        assert anon.get(f"{API}/portal/{token}", timeout=30).json()["selected_count"] == 1

        bad = anon.post(f"{API}/portal/{token}/photos/nope", json={"selected": True}, timeout=30)
        assert bad.status_code == 404

        pdf = anon.get(f"{API}/portal/{token}/invoice.pdf", timeout=60)
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"

        sub = anon.post(f"{API}/portal/{token}/submit-selection", timeout=30)
        assert sub.status_code == 200
        assert sub.json()["selected"] == 1
        again = anon.post(f"{API}/portal/{token}/submit-selection", timeout=30)
        assert again.status_code == 400
        locked = anon.post(f"{API}/portal/{token}/photos/{pid}", json={"selected": False}, timeout=30)
        assert locked.status_code == 400
        after = owner.get(f"{API}/bookings/{bid}", timeout=30).json()
        assert after["selection_submitted"] is True
        assert after["editing_status"] == "antre_edit"

        delp = owner.delete(f"{API}/bookings/{bid}/photos/{pid}", timeout=30)
        assert delp.status_code == 200

    def test_portal_invalid_token_404(self, anon):
        r = anon.get(f"{API}/portal/invalidtoken123", timeout=30)
        assert r.status_code == 404
