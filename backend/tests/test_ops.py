"""Ops module: dashboard stats, finance summary, expenses CRUD, analytics, notifications, users."""
import time
import requests
import pytest
from conftest import API


class TestDashboard:
    def test_dashboard_stats(self, owner):
        r = owner.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_bookings", "total_revenue", "dp_received", "outstanding",
                  "total_expenses", "net_profit", "clients", "upcoming", "overdue", "photo_queue"]:
            assert k in d, f"missing {k}"
        assert d["total_bookings"] >= 8
        assert d["net_profit"] == d["total_revenue"] - d["total_expenses"]
        assert isinstance(d["upcoming"], list)


class TestFinance:
    def test_finance_summary_structure(self, owner):
        r = owner.get(f"{API}/finance/summary", params={"granularity": "month"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["net_income"] == d["revenue"] - d["total_expenses"]
        assert isinstance(d["series"], list)
        assert len(d["recent_payments"]) > 0
        assert d["payments_count"] >= len(d["recent_payments"])

    def test_finance_range_filter(self, owner):
        r = owner.get(f"{API}/finance/summary", params={
            "date_from": "2020-01-01", "date_to": "2020-12-31"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["revenue"] == 0 and d["total_expenses"] == 0


class TestExpenses:
    def test_create_list_delete_expense(self, owner):
        payload = {"date": "2026-07-05", "name": "TEST_Sewa Lensa", "category": "Peralatan",
                   "amount": 350000, "method": "Transfer Bank", "description": "TEST"}
        c = owner.post(f"{API}/expenses", json=payload, timeout=30)
        assert c.status_code == 200, c.text[:300]
        e = c.json()
        assert e["amount"] == 350000 and e["name"] == payload["name"]
        assert "_id" not in e

        lst = owner.get(f"{API}/expenses", timeout=30).json()
        assert any(x["id"] == e["id"] for x in lst)

        filtered = owner.get(f"{API}/expenses", params={"date_from": "2026-07-01", "date_to": "2026-07-31"}, timeout=30).json()
        assert all("2026-07-01" <= x["date"] <= "2026-07-31" for x in filtered)

        d = owner.delete(f"{API}/expenses/{e['id']}", timeout=30)
        assert d.status_code == 200
        lst2 = owner.get(f"{API}/expenses", timeout=30).json()
        assert not any(x["id"] == e["id"] for x in lst2)

    def test_negative_expense_rejected(self, owner):
        r = owner.post(f"{API}/expenses", json={"date": "2026-07-05", "name": "TEST_bad",
                                                "category": "Lain", "amount": 0}, timeout=30)
        assert r.status_code == 400


class TestAnalytics:
    def test_analytics(self, owner):
        r = owner.get(f"{API}/analytics", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["monthly"]) == 12
        assert len(d["packages"]) > 0
        assert len(d["by_photographer"]) > 0
        assert len(d["by_location"]) > 0
        assert d["avg_booking_value"] > 0
        assert any(c["count"] > 1 for c in d["repeat_clients"]), "Expected repeat client (Andini Prameswari)"


class TestNotifications:
    def test_list_and_run_checks(self, owner):
        r = owner.get(f"{API}/notifications", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert all("type" in n and "created_at" in n for n in items)

        run = owner.post(f"{API}/notifications/run-checks", timeout=60)
        assert run.status_code == 200
        assert "created" in run.json()
        # dedupe: second run should create 0
        run2 = owner.post(f"{API}/notifications/run-checks", timeout=60)
        assert run2.json()["created"] == 0

    def test_notifications_forbidden_for_photographer(self, photographer):
        r = photographer.get(f"{API}/notifications", timeout=30)
        assert r.status_code == 403


class TestUsers:
    created_ids = []

    def test_list_users_no_hash(self, owner):
        r = owner.get(f"{API}/users", timeout=30)
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 3
        assert all("password_hash" not in u and "_id" not in u for u in users)

    def test_create_photographer_and_login(self, owner):
        email = f"test_fotografer_{int(time.time())}@twins.id"
        password = "TestFoto2026!"
        c = owner.post(f"{API}/users", json={"name": "TEST_Fotografer Baru", "email": email,
                                             "password": password, "role": "photographer"}, timeout=30)
        assert c.status_code == 200, c.text[:300]
        uid = c.json()["id"]
        TestUsers.created_ids.append(uid)
        assert c.json()["role"] == "photographer"

        s = requests.Session()
        li = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
        assert li.status_code == 200, li.text[:300]
        assert li.json()["role"] == "photographer"

        dup = owner.post(f"{API}/users", json={"name": "dup", "email": email,
                                               "password": password, "role": "photographer"}, timeout=30)
        assert dup.status_code == 400

        bad = owner.post(f"{API}/users", json={"name": "x", "email": f"x{email}",
                                               "password": password, "role": "owner"}, timeout=30)
        assert bad.status_code == 400

        d = owner.delete(f"{API}/users/{uid}", timeout=30)
        assert d.status_code == 200
        TestUsers.created_ids.remove(uid)
        assert not any(u["id"] == uid for u in owner.get(f"{API}/users", timeout=30).json())

    def test_cannot_delete_self(self, owner):
        me = owner.get(f"{API}/auth/me", timeout=30).json()
        r = owner.delete(f"{API}/users/{me['id']}", timeout=30)
        assert r.status_code == 400
