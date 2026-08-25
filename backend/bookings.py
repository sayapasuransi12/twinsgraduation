import uuid
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from database import db
from auth import get_current_user, require_roles
from invoice_pdf import build_invoice_pdf

router = APIRouter()

BUSINESS = {
    "name": "Twins Graduation",
    "tagline": "Studio Fotografi Wisuda & Event",
    "phone": "+62 812-3456-7890",
    "email": "halo@twinsgraduation.id",
    "address": "Jl. Kenanga No. 12, Yogyakarta",
}

BOOKING_STATUSES = ["pending", "confirmed", "dp_paid", "fully_paid", "completed", "cancelled", "rescheduled"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def today_str():
    return datetime.now(timezone.utc).date().isoformat()


def compute_payment_status(total: float, paid: float) -> str:
    if total > 0 and paid >= total:
        return "lunas"
    if paid > 0:
        return "dp"
    return "belum"


async def next_invoice_number() -> str:
    c = await db.counters.find_one_and_update(
        {"_id": "invoice"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return f"INV-{datetime.now(timezone.utc).year}-{c['seq']:04d}"


async def queue_notification(type_: str, title: str, message: str, booking_id: str = None, dedupe_key: str = None):
    if dedupe_key and await db.notifications.find_one({"dedupe_key": dedupe_key}):
        return
    await db.notifications.insert_one({
        "id": new_id(), "type": type_, "title": title, "message": message,
        "booking_id": booking_id, "channel": "system", "status": "antre",
        "dedupe_key": dedupe_key, "created_at": now_iso(),
    })


def to_minutes(t: str) -> int:
    try:
        parts = (t or "").split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return -1


def find_conflicts(same_day: list, target: dict) -> list:
    conflicts = []
    t_min = to_minutes(target.get("booking_time", ""))
    if t_min < 0:
        return conflicts
    for b in same_day:
        if b["id"] == target.get("id") or b.get("status") == "cancelled":
            continue
        b_min = to_minutes(b.get("booking_time", ""))
        if b_min >= 0 and abs(b_min - t_min) < 120:
            conflicts.append({"id": b["id"], "client_name": b["client_name"], "booking_time": b.get("booking_time", "")})
    return conflicts


class BookingCreate(BaseModel):
    client_name: str
    phone: str
    instagram: Optional[str] = ""
    package: str
    booking_date: str
    booking_time: str
    location: str
    total_price: float
    dp_amount: float = 0
    payment_method: Optional[str] = ""
    notes: Optional[str] = ""
    photographer_id: Optional[str] = ""
    photo_quota: int = 20


async def build_booking_doc(body: BookingCreate) -> dict:
    photographer_name = ""
    if body.photographer_id:
        p = await db.users.find_one({"id": body.photographer_id})
        photographer_name = p["name"] if p else ""
    return {
        "id": new_id(),
        "invoice_number": await next_invoice_number(),
        "portal_token": uuid.uuid4().hex[:24],
        **body.model_dump(),
        "photographer_name": photographer_name,
        "paid_amount": 0,
        "remaining": body.total_price,
        "payment_status": "belum",
        "status": "pending",
        "payment_deadline": body.booking_date,
        "drive_link": "",
        "photos": [],
        "selection_submitted": False,
        "editing_status": "menunggu_seleksi",
        "delivery_status": "belum",
        "admin_notes": "",
        "invoice_sent_at": None,
        "created_at": now_iso(),
    }


@router.post("/public/bookings")
async def public_create_booking(body: BookingCreate):
    doc = await build_booking_doc(body)
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    await queue_notification(
        "booking_baru", "Booking baru masuk",
        f"{doc['client_name']} memesan {doc['package']} untuk {doc['booking_date']} pukul {doc['booking_time']} di {doc['location']}.",
        doc["id"],
    )
    return {"id": doc["id"], "portal_token": doc["portal_token"], "invoice_number": doc["invoice_number"]}


@router.get("/public/packages")
async def public_packages():
    s = await db.settings.find_one({"key": "packages"}, {"_id": 0})
    return s["packages"] if s else []


@router.post("/bookings")
async def admin_create_booking(body: BookingCreate, user: dict = Depends(require_roles("owner", "admin"))):
    doc = await build_booking_doc(body)
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    await queue_notification(
        "booking_baru", "Booking dibuat manual",
        f"{doc['client_name']} — {doc['package']} pada {doc['booking_date']} {doc['booking_time']}.",
        doc["id"],
    )
    return doc


@router.get("/bookings")
async def list_bookings(
    search: str = "", status: str = "", payment_status: str = "",
    photographer_id: str = "", date_from: str = "", date_to: str = "",
    user: dict = Depends(get_current_user),
):
    q = {}
    if user["role"] == "photographer":
        q["photographer_id"] = user["id"]
    elif photographer_id:
        q["photographer_id"] = photographer_id
    if status:
        q["status"] = status
    if payment_status:
        q["payment_status"] = payment_status
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        q["booking_date"] = rng
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"client_name": rx}, {"phone": rx}, {"invoice_number": rx}, {"instagram": rx}]
    return await db.bookings.find(q, {"_id": 0}).sort("booking_date", -1).to_list(5000)


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    if user["role"] == "photographer" and b.get("photographer_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    b["payments"] = await db.payments.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    same_day = await db.bookings.find({"booking_date": b["booking_date"]}, {"_id": 0}).to_list(500)
    b["conflicts"] = find_conflicts(same_day, b)
    b["business"] = BUSINESS
    return b


class BookingUpdate(BaseModel):
    client_name: Optional[str] = None
    phone: Optional[str] = None
    instagram: Optional[str] = None
    package: Optional[str] = None
    booking_date: Optional[str] = None
    booking_time: Optional[str] = None
    location: Optional[str] = None
    total_price: Optional[float] = None
    dp_amount: Optional[float] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    payment_deadline: Optional[str] = None
    photographer_id: Optional[str] = None
    drive_link: Optional[str] = None
    photo_quota: Optional[int] = None
    editing_status: Optional[str] = None
    delivery_status: Optional[str] = None
    admin_notes: Optional[str] = None


@router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, body: BookingUpdate, user: dict = Depends(require_roles("owner", "admin"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "status" in updates and updates["status"] not in BOOKING_STATUSES:
        raise HTTPException(400, "Status tidak valid")
    if "photographer_id" in updates:
        if updates["photographer_id"]:
            p = await db.users.find_one({"id": updates["photographer_id"]})
            updates["photographer_name"] = p["name"] if p else ""
        else:
            updates["photographer_name"] = ""
    if "total_price" in updates:
        total = updates["total_price"]
        updates["remaining"] = max(total - b.get("paid_amount", 0), 0)
        updates["payment_status"] = compute_payment_status(total, b.get("paid_amount", 0))
    if updates:
        await db.bookings.update_one({"id": booking_id}, {"$set": updates})
    return await db.bookings.find_one({"id": booking_id}, {"_id": 0})


class PaymentCreate(BaseModel):
    amount: float
    method: str = "Transfer Bank"
    type: str = "dp"
    note: str = ""
    date: Optional[str] = None


@router.post("/bookings/{booking_id}/payments")
async def add_payment(booking_id: str, body: PaymentCreate, user: dict = Depends(require_roles("owner", "admin"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    if body.amount <= 0:
        raise HTTPException(400, "Jumlah pembayaran harus lebih dari 0")
    pay = {
        "id": new_id(), "booking_id": booking_id, "amount": body.amount, "method": body.method,
        "type": body.type, "note": body.note, "date": body.date or today_str(),
        "created_by": user.get("name", ""), "created_at": now_iso(),
    }
    await db.payments.insert_one(pay)
    paid = b.get("paid_amount", 0) + body.amount
    total = b["total_price"]
    ps = compute_payment_status(total, paid)
    updates = {"paid_amount": paid, "remaining": max(total - paid, 0), "payment_status": ps}
    if b["status"] not in ("completed", "cancelled"):
        updates["status"] = "fully_paid" if ps == "lunas" else "dp_paid"
    await db.bookings.update_one({"id": booking_id}, {"$set": updates})
    rp = f"Rp {int(body.amount):,}".replace(",", ".")
    await queue_notification(
        "pembayaran_diterima", "Pembayaran diterima",
        f"{rp} diterima dari {b['client_name']} ({b['invoice_number']}) via {body.method}.",
        booking_id,
    )
    pay.pop("_id", None)
    return pay


@router.delete("/bookings/{booking_id}/payments/{payment_id}")
async def delete_payment(booking_id: str, payment_id: str, user: dict = Depends(require_roles("owner"))):
    await db.payments.delete_one({"id": payment_id, "booking_id": booking_id})
    pays = await db.payments.find({"booking_id": booking_id}).to_list(1000)
    b = await db.bookings.find_one({"id": booking_id})
    paid = sum(p["amount"] for p in pays)
    total = b["total_price"]
    await db.bookings.update_one({"id": booking_id}, {"$set": {
        "paid_amount": paid, "remaining": max(total - paid, 0),
        "payment_status": compute_payment_status(total, paid),
    }})
    return {"ok": True}


class PhotosAdd(BaseModel):
    urls: List[str]


@router.post("/bookings/{booking_id}/photos")
async def add_photos(booking_id: str, body: PhotosAdd, user: dict = Depends(require_roles("owner", "admin"))):
    photos = [{"id": new_id(), "url": u.strip(), "selected": False, "note": ""} for u in body.urls if u.strip()]
    if not photos:
        raise HTTPException(400, "Tidak ada URL foto")
    await db.bookings.update_one({"id": booking_id}, {"$push": {"photos": {"$each": photos}}})
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return b.get("photos", [])


@router.delete("/bookings/{booking_id}/photos/{photo_id}")
async def delete_photo(booking_id: str, photo_id: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.bookings.update_one({"id": booking_id}, {"$pull": {"photos": {"id": photo_id}}})
    return {"ok": True}


@router.get("/bookings/{booking_id}/invoice")
async def invoice_data(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    return {"booking": b, "business": BUSINESS}


@router.get("/bookings/{booking_id}/invoice.pdf")
async def invoice_pdf(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    pdf = build_invoice_pdf(b, BUSINESS)
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{b["invoice_number"]}.pdf"'})


@router.post("/bookings/{booking_id}/invoice/send")
async def send_invoice(booking_id: str, user: dict = Depends(require_roles("owner", "admin"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"invoice_sent_at": now_iso()}})
    await queue_notification(
        "invoice_terkirim", "Invoice dikirim",
        f"Invoice {b['invoice_number']} dikirim ke {b['client_name']} ({b['phone']}) — simulasi, siap integrasi WhatsApp/email.",
        booking_id,
    )
    return {"ok": True}


@router.get("/schedule")
async def schedule(start: str, end: str, user: dict = Depends(get_current_user)):
    q = {"booking_date": {"$gte": start, "$lte": end}}
    if user["role"] == "photographer":
        q["photographer_id"] = user["id"]
    docs = await db.bookings.find(q, {"_id": 0}).sort("booking_time", 1).to_list(5000)
    by_date = {}
    for d in docs:
        by_date.setdefault(d["booking_date"], []).append(d)
    for items in by_date.values():
        for it in items:
            it["conflict"] = len(find_conflicts(items, it)) > 0
    return docs


async def portal_booking(token: str):
    b = await db.bookings.find_one({"portal_token": token}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking tidak ditemukan")
    return b


@router.get("/portal/{token}")
async def portal_view(token: str):
    b = await portal_booking(token)
    payments = await db.payments.find({"booking_id": b["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    selected = sum(1 for p in b.get("photos", []) if p.get("selected"))
    return {"booking": b, "business": BUSINESS, "payments": payments, "selected_count": selected}


class PhotoSelect(BaseModel):
    selected: bool
    note: Optional[str] = None


@router.post("/portal/{token}/photos/{photo_id}")
async def portal_select_photo(token: str, photo_id: str, body: PhotoSelect):
    b = await portal_booking(token)
    if b.get("selection_submitted"):
        raise HTTPException(400, "Seleksi foto sudah dikirim final dan tidak dapat diubah.")
    update = {"photos.$.selected": body.selected}
    if body.note is not None:
        update["photos.$.note"] = body.note
    res = await db.bookings.update_one({"portal_token": token, "photos.id": photo_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Foto tidak ditemukan")
    return {"ok": True}


@router.post("/portal/{token}/submit-selection")
async def portal_submit_selection(token: str):
    b = await portal_booking(token)
    if b.get("selection_submitted"):
        raise HTTPException(400, "Seleksi foto sudah dikirim sebelumnya.")
    selected = [p for p in b.get("photos", []) if p.get("selected")]
    if not selected:
        raise HTTPException(400, "Belum ada foto yang dipilih.")
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"selection_submitted": True, "editing_status": "antre_edit"}})
    await queue_notification(
        "pemilihan_foto", "Seleksi foto dikirim",
        f"{b['client_name']} mengirim {len(selected)} foto untuk diedit ({b['invoice_number']}).",
        b["id"],
    )
    return {"ok": True, "selected": len(selected)}


@router.get("/portal/{token}/invoice.pdf")
async def portal_invoice_pdf(token: str):
    b = await portal_booking(token)
    pdf = build_invoice_pdf(b, BUSINESS)
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{b["invoice_number"]}.pdf"'})
