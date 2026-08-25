from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db
from auth import require_roles, hash_password
from bookings import queue_notification, new_id, now_iso, today_str, get_site

router = APIRouter()


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str


@router.get("/users")
async def list_users(user: dict = Depends(require_roles("owner"))):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)


@router.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_roles("owner"))):
    if body.role not in ("admin", "photographer"):
        raise HTTPException(400, "Peran tidak valid")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    doc = {
        "id": new_id(), "email": email, "name": body.name, "role": body.role,
        "password_hash": hash_password(body.password), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {"id": doc["id"], "email": email, "name": body.name, "role": body.role}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("owner"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    await db.users.delete_one({"id": user_id, "role": {"$in": ["admin", "photographer"]}})
    return {"ok": True}


@router.get("/photographers")
async def list_photographers(user: dict = Depends(require_roles("owner", "admin"))):
    return await db.users.find({"role": "photographer"}, {"_id": 0, "password_hash": 0}).to_list(500)


class ExpenseCreate(BaseModel):
    date: str
    name: str
    category: str
    amount: float
    method: str = "Cash"
    description: str = ""
    receipt_url: str = ""


@router.get("/expenses")
async def list_expenses(date_from: str = "", date_to: str = "", user: dict = Depends(require_roles("owner"))):
    q = {}
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        q["date"] = rng
    return await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(10000)


@router.post("/expenses")
async def create_expense(body: ExpenseCreate, user: dict = Depends(require_roles("owner"))):
    if body.amount <= 0:
        raise HTTPException(400, "Jumlah pengeluaran harus lebih dari 0")
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso(), "created_by": user.get("name", "")}
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(require_roles("owner"))):
    await db.expenses.delete_one({"id": expense_id})
    return {"ok": True}


def _range_q(field: str, date_from: str, date_to: str):
    if not date_from and not date_to:
        return {}
    rng = {}
    if date_from:
        rng["$gte"] = date_from
    if date_to:
        rng["$lte"] = date_to
    return {field: rng}


@router.get("/finance/summary")
async def finance_summary(date_from: str = "", date_to: str = "", granularity: str = "day",
                          user: dict = Depends(require_roles("owner"))):
    payments = await db.payments.find(_range_q("date", date_from, date_to), {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find(_range_q("date", date_from, date_to), {"_id": 0}).to_list(50000)
    bq = _range_q("booking_date", date_from, date_to)
    bq["status"] = {"$ne": "cancelled"}
    bookings = await db.bookings.find(bq, {"_id": 0}).to_list(50000)
    revenue = sum(p["amount"] for p in payments)
    dp_received = sum(p["amount"] for p in payments if p.get("type") == "dp")
    total_expenses = sum(e["amount"] for e in expenses)
    outstanding = sum(b.get("remaining", 0) for b in bookings)

    def bucket(d):
        return (d or "")[:7] if granularity == "month" else (d or "")[:10]

    series = {}
    for p in payments:
        series.setdefault(bucket(p["date"]), {"revenue": 0, "expenses": 0})["revenue"] += p["amount"]
    for e in expenses:
        series.setdefault(bucket(e["date"]), {"revenue": 0, "expenses": 0})["expenses"] += e["amount"]
    ts = [{"label": k, "revenue": v["revenue"], "expenses": v["expenses"], "profit": v["revenue"] - v["expenses"]}
          for k, v in sorted(series.items()) if k]
    return {
        "revenue": revenue,
        "dp_received": dp_received,
        "outstanding": outstanding,
        "total_expenses": total_expenses,
        "net_income": revenue - total_expenses,
        "fully_paid_count": sum(1 for b in bookings if b["payment_status"] == "lunas"),
        "unpaid_count": sum(1 for b in bookings if b["payment_status"] != "lunas"),
        "payments_count": len(payments),
        "series": ts,
        "recent_payments": sorted(payments, key=lambda p: p["created_at"], reverse=True)[:10],
    }


@router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(require_roles("owner", "admin"))):
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(50000)
    payments = await db.payments.find({}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(50000)
    today = today_str()
    active = [b for b in bookings if b["status"] != "cancelled"]
    total_revenue = sum(p["amount"] for p in payments)
    total_expenses = sum(e["amount"] for e in expenses)
    upcoming = sorted(
        [b for b in active if b["booking_date"] >= today and b["status"] != "completed"],
        key=lambda b: (b["booking_date"], b.get("booking_time", "")),
    )[:6]
    overdue = [b for b in active if b.get("remaining", 0) > 0 and b.get("payment_deadline", "9999") <= today]
    return {
        "total_bookings": len(bookings),
        "today_bookings": sum(1 for b in bookings if b["booking_date"] == today),
        "upcoming_count": sum(1 for b in active if b["booking_date"] >= today and b["status"] != "completed"),
        "completed": sum(1 for b in bookings if b["status"] == "completed"),
        "pending": sum(1 for b in bookings if b["status"] == "pending"),
        "total_revenue": total_revenue,
        "dp_received": sum(p["amount"] for p in payments if p.get("type") == "dp"),
        "outstanding": sum(b.get("remaining", 0) for b in active),
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "clients": len({b["phone"] for b in bookings}),
        "upcoming": upcoming,
        "overdue": sorted(overdue, key=lambda b: b.get("payment_deadline", ""))[:6],
        "photo_queue": [b for b in bookings if b.get("selection_submitted") and b.get("editing_status") != "selesai"][:6],
    }


@router.get("/analytics")
async def analytics(user: dict = Depends(require_roles("owner"))):
    payments = await db.payments.find({}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(50000)
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(50000)
    base = date.today().replace(day=1)
    y, m = base.year, base.month
    keys = []
    for _ in range(12):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    keys.reverse()
    monthly = {k: {"month": k, "revenue": 0, "expenses": 0, "bookings": 0} for k in keys}
    for p in payments:
        k = (p.get("date") or "")[:7]
        if k in monthly:
            monthly[k]["revenue"] += p["amount"]
    for e in expenses:
        k = (e.get("date") or "")[:7]
        if k in monthly:
            monthly[k]["expenses"] += e["amount"]
    for b in bookings:
        k = (b.get("booking_date") or "")[:7]
        if k in monthly:
            monthly[k]["bookings"] += 1
    series = [{**v, "profit": v["revenue"] - v["expenses"]} for v in monthly.values()]

    pkg = {}
    for b in bookings:
        if b["status"] == "cancelled":
            continue
        s = pkg.setdefault(b["package"], {"package": b["package"], "count": 0, "revenue": 0})
        s["count"] += 1
        s["revenue"] += b["total_price"]
    photog = {}
    for b in bookings:
        if b["status"] == "cancelled":
            continue
        name = b.get("photographer_name") or "Belum ditugaskan"
        photog.setdefault(name, {"name": name, "revenue": 0, "count": 0})
        photog[name]["revenue"] += b["total_price"]
        photog[name]["count"] += 1
    loc = {}
    for b in bookings:
        if b["status"] == "cancelled":
            continue
        name = (b.get("location") or "-")[:24]
        loc.setdefault(name, {"name": name, "revenue": 0, "count": 0})
        loc[name]["revenue"] += b["total_price"]
        loc[name]["count"] += 1
    phones = {}
    for b in bookings:
        phones.setdefault(b["phone"], {"phone": b["phone"], "name": b["client_name"], "count": 0})
        phones[b["phone"]]["count"] += 1
    active = [b for b in bookings if b["status"] != "cancelled"]
    return {
        "monthly": series,
        "packages": sorted(pkg.values(), key=lambda x: -x["revenue"]),
        "by_photographer": sorted(photog.values(), key=lambda x: -x["revenue"]),
        "by_location": sorted(loc.values(), key=lambda x: -x["revenue"])[:8],
        "repeat_clients": sorted([p for p in phones.values() if p["count"] > 1], key=lambda x: -x["count"]),
        "avg_booking_value": (sum(b["total_price"] for b in active) / len(active)) if active else 0,
        "outstanding": sum(b.get("remaining", 0) for b in active),
        "total_bookings": len(bookings),
    }


@router.get("/notifications")
async def list_notifications(user: dict = Depends(require_roles("owner", "admin"))):
    return await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/notifications/run-checks")
async def run_checks(user: dict = Depends(require_roles("owner", "admin"))):
    today = date.today()
    bookings = await db.bookings.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(50000)
    created = 0
    for b in bookings:
        try:
            bdate = date.fromisoformat(b["booking_date"])
        except ValueError:
            continue
        checks = []
        if bdate == today + timedelta(days=1) and b["status"] != "completed":
            checks.append(("pengingat_sesi", "Sesi foto besok",
                           f"Sesi {b['client_name']} besok pukul {b.get('booking_time', '')} di {b.get('location', '')}."))
        if b.get("dp_amount", 0) > 0 and b.get("paid_amount", 0) < b["dp_amount"] and 0 <= (bdate - today).days <= 5:
            checks.append(("dp_belum_bayar", "DP belum dibayar",
                           f"DP {b['client_name']} ({b['invoice_number']}) belum dibayar, sesi pada {b['booking_date']}."))
        if b.get("remaining", 0) > 0 and b.get("payment_deadline", "9999") <= (today + timedelta(days=3)).isoformat():
            checks.append(("sisa_belum_lunas", "Sisa pembayaran mendekati batas",
                           f"Sisa pembayaran {b['client_name']} ({b['invoice_number']}) jatuh tempo {b.get('payment_deadline', '')}."))
        if b.get("drive_link") and not b.get("selection_submitted") and bdate <= today and b["status"] in ("confirmed", "dp_paid", "fully_paid", "completed"):
            checks.append(("pemilihan_foto", "Menunggu seleksi foto",
                           f"{b['client_name']} belum mengirim seleksi foto untuk diedit."))
        if b.get("editing_status") == "selesai" and b.get("delivery_status") != "terkirim":
            checks.append(("pengiriman_final", "Foto final siap dikirim",
                           f"Hasil edit {b['client_name']} ({b['invoice_number']}) selesai, siap dikirim."))
        for type_, title, msg in checks:
            key = f"{type_}:{b['id']}:{today.isoformat()}"
            if not await db.notifications.find_one({"dedupe_key": key}):
                await queue_notification(type_, title, msg, b["id"], key)
                created += 1
    return {"created": created}


@router.get("/public/site")
async def public_site():
    return await get_site()


@router.get("/settings")
async def get_settings(user: dict = Depends(require_roles("owner"))):
    site = await get_site()
    pkgs = await db.settings.find_one({"key": "packages"}, {"_id": 0})
    return {**site, "packages": pkgs["packages"] if pkgs else []}


class SiteUpdate(BaseModel):
    business: Optional[dict] = None
    time_slots: Optional[List[str]] = None
    payment_methods: Optional[List[str]] = None


@router.patch("/settings")
async def update_settings(body: SiteUpdate, user: dict = Depends(require_roles("owner"))):
    existing = await db.settings.find_one({"key": "site"}) or {}
    value = existing.get("value", {})
    if body.business:
        allowed = {"name", "tagline", "phone", "email", "address"}
        cleaned = {k: str(v).strip() for k, v in body.business.items() if k in allowed and v is not None}
        if "name" in cleaned and not cleaned["name"]:
            raise HTTPException(400, "Nama studio tidak boleh kosong")
        value["business"] = {**value.get("business", {}), **cleaned}
    if body.time_slots is not None:
        value["time_slots"] = [s.strip() for s in body.time_slots if s.strip()]
    if body.payment_methods is not None:
        value["payment_methods"] = [s.strip() for s in body.payment_methods if s.strip()]
    await db.settings.update_one({"key": "site"}, {"$set": {"key": "site", "value": value}}, upsert=True)
    return await get_site()


class PackageItem(BaseModel):
    id: Optional[str] = ""
    name: str
    price: Optional[float] = None
    quota: int = 20
    desc: str = ""


class PackagesUpdate(BaseModel):
    packages: List[PackageItem]


@router.put("/settings/packages")
async def update_packages(body: PackagesUpdate, user: dict = Depends(require_roles("owner"))):
    cleaned = []
    for p in body.packages:
        if not p.name.strip():
            raise HTTPException(400, "Setiap paket wajib punya nama")
        if p.price is None:
            raise HTTPException(400, "Setiap paket wajib punya harga")
        if p.price <= 0:
            raise HTTPException(400, f"Harga paket '{p.name}' harus lebih dari 0")
        if p.quota < 1:
            raise HTTPException(400, f"Kuota foto paket '{p.name}' minimal 1")
        cleaned.append({
            "id": p.id or new_id(),
            "name": p.name.strip(),
            "price": p.price,
            "quota": p.quota,
            "desc": p.desc,
        })
    await db.settings.update_one({"key": "packages"}, {"$set": {"key": "packages", "packages": cleaned}}, upsert=True)
    return cleaned
