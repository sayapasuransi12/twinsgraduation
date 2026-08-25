"""Round-3: Settings (Pengaturan) feature — /api/public/site, /api/settings, /api/settings/packages"""
import pytest
import requests
from conftest import API

DEFAULT_BUSINESS = {
    "name": "Twins Graduation",
    "tagline": "Studio Fotografi Wisuda & Event",
    "phone": "+62 812-3456-7890",
    "email": "halo@twinsgraduation.id",
    "address": "Jl. Kenanga No. 12, Yogyakarta",
}
DEFAULT_SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
DEFAULT_METHODS = ["Transfer Bank", "Cash", "QRIS", "E-Wallet"]


@pytest.fixture(scope="module")
def original_state(owner):
    r = owner.get(f"{API}/settings", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# NOTE: pytest.ini uses xdist --dist loadscope (per-class workers). Each mutating class restores ONLY
# the fields it touches so parallel classes cannot clobber each other.
@pytest.fixture(scope="class")
def restore_business(owner, original_state):
    yield
    owner.patch(f"{API}/settings", json={"business": original_state["business"]}, timeout=30)


@pytest.fixture(scope="class")
def restore_form(owner, original_state):
    yield
    owner.patch(f"{API}/settings", json={
        "time_slots": original_state["time_slots"],
        "payment_methods": original_state["payment_methods"],
    }, timeout=30)


@pytest.fixture(scope="class")
def restore_packages(owner, original_state):
    yield
    owner.put(f"{API}/settings/packages", json={"packages": original_state["packages"]}, timeout=30)


# --- public/site ---
class TestPublicSite:
    def test_public_site_no_auth(self, anon):
        r = anon.get(f"{API}/public/site", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"business", "time_slots", "payment_methods"}
        assert "_id" not in d
        for k in DEFAULT_BUSINESS:
            assert k in d["business"]
        assert isinstance(d["time_slots"], list) and len(d["time_slots"]) > 0
        assert isinstance(d["payment_methods"], list) and len(d["payment_methods"]) > 0

    def test_public_packages_no_auth(self, anon):
        r = anon.get(f"{API}/public/packages", timeout=30)
        assert r.status_code == 200
        pkgs = r.json()
        assert isinstance(pkgs, list) and len(pkgs) >= 1
        for p in pkgs:
            assert "_id" not in p
            assert set(["id", "name", "price"]).issubset(p.keys())


# --- role guards ---
class TestSettingsRoleGuard:
    def test_get_settings_owner_ok(self, owner):
        r = owner.get(f"{API}/settings", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "business" in d and "packages" in d and "time_slots" in d
        assert "_id" not in d

    def test_get_settings_admin_forbidden(self, admin):
        assert admin.get(f"{API}/settings", timeout=30).status_code == 403

    def test_patch_settings_admin_forbidden(self, admin):
        r = admin.patch(f"{API}/settings", json={"business": {"name": "TEST_hack"}}, timeout=30)
        assert r.status_code == 403

    def test_put_packages_admin_forbidden(self, admin):
        r = admin.put(f"{API}/settings/packages", json={"packages": []}, timeout=30)
        assert r.status_code == 403

    def test_settings_photographer_forbidden(self, photographer):
        assert photographer.get(f"{API}/settings", timeout=30).status_code == 403
        assert photographer.patch(f"{API}/settings", json={"business": {}}, timeout=30).status_code == 403

    def test_settings_anon_unauthorized(self, anon):
        assert anon.get(f"{API}/settings", timeout=30).status_code in (401, 403)


# --- business info update ---
class TestBusinessInfo:
    @pytest.fixture(autouse=True)
    def _r(self, restore_business):
        pass

    def test_update_business_persists_and_public(self, owner, anon):
        payload = {"business": {"tagline": "TEST_Tagline QA", "address": "TEST_Jl. QA No. 99, Bandung"}}
        r = owner.patch(f"{API}/settings", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["business"]["tagline"] == "TEST_Tagline QA"
        assert d["business"]["address"] == "TEST_Jl. QA No. 99, Bandung"
        # untouched field intact
        assert d["business"]["name"]

        pub = anon.get(f"{API}/public/site", timeout=30).json()
        assert pub["business"]["tagline"] == "TEST_Tagline QA"
        assert pub["business"]["address"] == "TEST_Jl. QA No. 99, Bandung"

        got = owner.get(f"{API}/settings", timeout=30).json()
        assert got["business"]["address"] == "TEST_Jl. QA No. 99, Bandung"

    def test_business_ignores_unknown_keys(self, owner):
        r = owner.patch(f"{API}/settings", json={"business": {"name": "TEST_Studio", "evil": "x"}}, timeout=30)
        assert r.status_code == 200
        assert "evil" not in r.json()["business"]
        assert r.json()["business"]["name"] == "TEST_Studio"

    def test_invoice_pdf_uses_updated_business(self, owner):
        owner.patch(f"{API}/settings", json={"business": {"name": "TEST_Studio PDF"}}, timeout=30)
        created = owner.post(f"{API}/bookings", json={
            "client_name": "TEST_Invoice PDF", "phone": "08990000002", "package": "Paket Gold",
            "booking_date": "2030-02-01", "booking_time": "09:00", "location": "Studio",
            "total_price": 4000000, "dp_amount": 2000000}, timeout=30)
        assert created.status_code in (200, 201), created.text
        bid = created.json()["id"]
        r = owner.get(f"{API}/bookings/{bid}/invoice.pdf", timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert len(r.content) > 500
        det = owner.get(f"{API}/bookings/{bid}/invoice", timeout=30).json()
        assert det["business"]["name"] == "TEST_Studio PDF"
        owner.delete(f"{API}/bookings/{bid}", timeout=30)


# --- form options ---
class TestFormOptions:
    @pytest.fixture(autouse=True)
    def _r(self, restore_form):
        pass

    def test_time_slots_update(self, owner, anon):
        r = owner.patch(f"{API}/settings", json={"time_slots": ["07:00", " 10:00 ", "15:30", "  "]}, timeout=30)
        assert r.status_code == 200
        assert r.json()["time_slots"] == ["07:00", "10:00", "15:30"]
        assert anon.get(f"{API}/public/site", timeout=30).json()["time_slots"] == ["07:00", "10:00", "15:30"]

    def test_payment_methods_update(self, owner, anon):
        r = owner.patch(f"{API}/settings", json={"payment_methods": ["TEST_Transfer", "TEST_QRIS"]}, timeout=30)
        assert r.status_code == 200
        assert r.json()["payment_methods"] == ["TEST_Transfer", "TEST_QRIS"]
        assert anon.get(f"{API}/public/site", timeout=30).json()["payment_methods"] == ["TEST_Transfer", "TEST_QRIS"]

    def test_empty_list_falls_back_to_defaults(self, owner):
        r = owner.patch(f"{API}/settings", json={"time_slots": []}, timeout=30)
        assert r.status_code == 200
        assert r.json()["time_slots"] == DEFAULT_SLOTS

    def test_partial_patch_does_not_clear_other_fields(self, owner):
        owner.patch(f"{API}/settings", json={"time_slots": ["09:00"], "payment_methods": ["TEST_Cash"]}, timeout=30)
        r = owner.patch(f"{API}/settings", json={"time_slots": ["08:00"]}, timeout=30)
        assert r.json()["payment_methods"] == ["TEST_Cash"]
        assert r.json()["time_slots"] == ["08:00"]


# --- packages CRUD ---
class TestPackagesCRUD:
    @pytest.fixture(autouse=True)
    def _r(self, restore_packages):
        pass

    def test_add_edit_delete_package(self, owner, anon, original_state):
        base = original_state["packages"]
        new_pkg = {"id": "", "name": "TEST_Paket QA", "price": 1234000, "quota": 7, "desc": "TEST desc"}
        r = owner.put(f"{API}/settings/packages", json={"packages": base + [new_pkg]}, timeout=30)
        assert r.status_code == 200, r.text
        saved = r.json()
        assert len(saved) == len(base) + 1
        added = [p for p in saved if p["name"] == "TEST_Paket QA"][0]
        assert added["id"] and added["price"] == 1234000.0 and added["quota"] == 7
        assert added["desc"] == "TEST desc"

        pub = anon.get(f"{API}/public/packages", timeout=30).json()
        assert any(p["name"] == "TEST_Paket QA" and p["price"] == 1234000 for p in pub)

        # edit price
        edited = [{**p, "price": 999000} if p["name"] == "TEST_Paket QA" else p for p in saved]
        r2 = owner.put(f"{API}/settings/packages", json={"packages": edited}, timeout=30)
        assert r2.status_code == 200
        pub2 = anon.get(f"{API}/public/packages", timeout=30).json()
        assert [p for p in pub2 if p["name"] == "TEST_Paket QA"][0]["price"] == 999000

        # delete
        remaining = [p for p in edited if p["name"] != "TEST_Paket QA"]
        r3 = owner.put(f"{API}/settings/packages", json={"packages": remaining}, timeout=30)
        assert r3.status_code == 200
        pub3 = anon.get(f"{API}/public/packages", timeout=30).json()
        assert not any(p["name"] == "TEST_Paket QA" for p in pub3)

    def test_package_id_stable_on_edit(self, owner, original_state):
        pkgs = owner.get(f"{API}/settings", timeout=30).json()["packages"]
        assert pkgs, "no packages"
        first_id = pkgs[0]["id"]
        pkgs[0]["desc"] = "TEST_updated desc"
        r = owner.put(f"{API}/settings/packages", json={"packages": pkgs}, timeout=30)
        assert r.status_code == 200
        assert r.json()[0]["id"] == first_id
        assert r.json()[0]["desc"] == "TEST_updated desc"

    def test_package_validation_missing_name(self, owner, original_state):
        r = owner.put(f"{API}/settings/packages",
                      json={"packages": [{"name": "", "price": 100000}]}, timeout=30)
        assert r.status_code == 400
        assert "nama" in r.text.lower()

    def test_package_validation_missing_price(self, owner):
        r = owner.put(f"{API}/settings/packages",
                      json={"packages": [{"name": "TEST_NoPrice"}]}, timeout=30)
        assert r.status_code == 400

    def test_package_invalid_price_type(self, owner):
        r = owner.put(f"{API}/settings/packages",
                      json={"packages": [{"name": "TEST_Bad", "price": "abc"}]}, timeout=30)
        assert r.status_code in (400, 422), f"expected 4xx, got {r.status_code} {r.text[:200]}"

    def test_public_packages_unaffected_by_failed_save(self, owner, anon, original_state):
        before = anon.get(f"{API}/public/packages", timeout=30).json()
        owner.put(f"{API}/settings/packages", json={"packages": [{"name": "", "price": 0}]}, timeout=30)
        after = anon.get(f"{API}/public/packages", timeout=30).json()
        assert [p["name"] for p in before] == [p["name"] for p in after]
