import uuid
from datetime import datetime, timezone, timedelta, date
from database import db
from auth import hash_password

GALLERY = [
    "https://images.unsplash.com/photo-1498079022511-d15614cb1c02?w=800&q=80",
    "https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?w=800&q=80",
    "https://images.unsplash.com/photo-1633734973050-d6499a977c17?w=800&q=80",
    "https://images.unsplash.com/photo-1618355776464-8666794d2520?w=800&q=80",
    "https://images.pexels.com/photos/12477691/pexels-photo-12477691.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/33361972/pexels-photo-33361972.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.unsplash.com/photo-1695425173758-37e9c23b962a?w=800&q=80",
    "https://images.pexels.com/photos/32962732/pexels-photo-32962732.jpeg?auto=compress&cs=tinysrgb&w=800",
]

PACKAGES = [
    {"id": "bronze", "name": "Paket Bronze", "price": 1500000, "quota": 10,
     "desc": "1 jam sesi studio, 10 foto edit, file digital"},
    {"id": "silver", "name": "Paket Silver", "price": 2500000, "quota": 15,
     "desc": "2 jam sesi, 15 foto edit, 1 lokasi outdoor"},
    {"id": "gold", "name": "Paket Gold", "price": 4000000, "quota": 20,
     "desc": "3 jam sesi, 20 foto edit, 2 lokasi, cetak 10R"},
    {"id": "platinum", "name": "Paket Platinum", "price": 6500000, "quota": 30,
     "desc": "Full day, 30 foto edit, multi lokasi, album premium"},
]


def new_id():
    return str(uuid.uuid4())


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def seed_all():
    if not await db.settings.find_one({"key": "packages"}):
        await db.settings.insert_one({"key": "packages", "packages": PACKAGES})

    if not await db.users.find_one({"email": "admin@twins.id"}):
        await db.users.insert_one({
            "id": new_id(), "email": "admin@twins.id", "name": "Sinta Maharani",
            "role": "admin", "password_hash": hash_password("Admin2026!"), "created_at": now_iso(),
        })
    if not await db.users.find_one({"email": "fotografer@twins.id"}):
        await db.users.insert_one({
            "id": new_id(), "email": "fotografer@twins.id", "name": "Rama Wijaya",
            "role": "photographer", "password_hash": hash_password("Foto2026!"), "created_at": now_iso(),
        })

    if await db.bookings.count_documents({}) > 0:
        return

    photog = await db.users.find_one({"email": "fotografer@twins.id"})
    pid, pname = photog["id"], photog["name"]
    today = date.today()
    inv_seq = 0

    def d(offset):
        return (today + timedelta(days=offset)).isoformat()

    def make_booking(client_name, phone, ig, package, price, quota, day, time, location,
                     status, paid, dp, method="Transfer Bank", notes="", with_photos=False,
                     drive="", editing="menunggu_seleksi", delivery="belum", submitted=False,
                     photographer_id="", photographer_name="", deadline=None):
        nonlocal inv_seq
        inv_seq += 1
        ps = "lunas" if paid >= price else ("dp" if paid > 0 else "belum")
        photos = []
        if with_photos:
            photos = [
                {"id": new_id(), "url": u, "selected": i < 5,
                 "note": "Yang ini dibuat hitam putih ya" if i == 1 else ""}
                for i, u in enumerate(GALLERY)
            ]
        return {
            "id": new_id(), "invoice_number": f"INV-{today.year}-{inv_seq:04d}",
            "portal_token": uuid.uuid4().hex[:24],
            "client_name": client_name, "phone": phone, "instagram": ig,
            "package": package, "booking_date": day, "booking_time": time, "location": location,
            "total_price": price, "dp_amount": dp, "paid_amount": paid,
            "remaining": max(price - paid, 0), "payment_method": method, "notes": notes,
            "payment_status": ps, "status": status,
            "payment_deadline": deadline or day,
            "photographer_id": photographer_id, "photographer_name": photographer_name,
            "drive_link": drive, "photo_quota": quota, "photos": photos,
            "selection_submitted": submitted, "editing_status": editing, "delivery_status": delivery,
            "admin_notes": "", "invoice_sent_at": None, "created_at": now_iso(),
        }

    bookings = [
        make_booking("Andini Prameswari", "081234560001", "andinipr", "Paket Gold", 4000000, 20,
                     d(-90), "09:00", "Balairung UGM, Yogyakarta", "completed", 4000000, 2000000,
                     with_photos=True, drive="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456",
                     editing="selesai", delivery="terkirim", submitted=True, photographer_id=pid, photographer_name=pname),
        make_booking("Bagas Saputra", "081234560002", "bagassap", "Paket Silver", 2500000, 15,
                     d(-45), "13:00", "Taman Sari, Yogyakarta", "completed", 2500000, 1000000,
                     photographer_id=pid, photographer_name=pname),
        make_booking("Citra Lestari", "081234560003", "citralst", "Paket Gold", 4000000, 20,
                     d(-2), "08:00", "Kampus UPN Veteran, Yogyakarta", "fully_paid", 4000000, 2000000,
                     photographer_id=pid, photographer_name=pname),
        make_booking("Dimas Anggara", "081234560004", "dimasang", "Paket Platinum", 6500000, 30,
                     d(2), "07:00", "Pantai Parangtritis, Bantul", "dp_paid", 3000000, 3000000,
                     notes="Klien minta konsep sunset", photographer_id=pid, photographer_name=pname),
        make_booking("Eka Putri", "081234560005", "ekaptr", "Paket Bronze", 1500000, 10,
                     d(7), "09:00", "Studio Twins, Yogyakarta", "pending", 0, 500000),
        make_booking("Gita Ramadhani", "081234560006", "gitarmdh", "Paket Silver", 2500000, 15,
                     d(7), "10:30", "Hutan Pinus Mangunan", "confirmed", 0, 1000000),
        make_booking("Fajar Nugroho", "081234560007", "fajarnug", "Paket Gold", 4000000, 20,
                     d(14), "15:00", "Kampus UII, Sleman", "pending", 0, 2000000),
        make_booking("Andini Prameswari", "081234560001", "andinipr", "Paket Bronze", 1500000, 10,
                     d(21), "10:00", "Studio Twins, Yogyakarta", "confirmed", 0, 500000,
                     notes="Sesi ulang tahun adik"),
    ]
    await db.bookings.insert_many(bookings)
    await db.counters.update_one({"_id": "invoice"}, {"$set": {"seq": inv_seq}}, upsert=True)

    payments = []
    for b in bookings:
        if b["paid_amount"] <= 0:
            continue
        dp_amt = min(b["dp_amount"], b["paid_amount"])
        payments.append({
            "id": new_id(), "booking_id": b["id"], "amount": dp_amt, "method": b["payment_method"],
            "type": "dp", "note": "Pembayaran DP", "date": b["booking_date"],
            "created_by": "Sinta Maharani", "created_at": now_iso(),
        })
        rest = b["paid_amount"] - dp_amt
        if rest > 0:
            payments.append({
                "id": new_id(), "booking_id": b["id"], "amount": rest, "method": "QRIS",
                "type": "pelunasan", "note": "Pelunasan", "date": b["booking_date"],
                "created_by": "Sinta Maharani", "created_at": now_iso(),
            })
    if payments:
        await db.payments.insert_many(payments)

    expenses = [
        {"date": d(-80), "name": "Bensin transportasi sesi UGM", "category": "Transportasi", "amount": 150000, "method": "Cash", "description": "PP studio - UGM"},
        {"date": d(-70), "name": "Reflektor & diffuser baru", "category": "Peralatan", "amount": 850000, "method": "Transfer Bank", "description": "Untuk sesi outdoor"},
        {"date": d(-40), "name": "Iklan Instagram Juni", "category": "Marketing", "amount": 500000, "method": "E-Wallet", "description": "Promo musim wisuda"},
        {"date": d(-15), "name": "Sewa studio tambahan", "category": "Studio", "amount": 400000, "method": "Transfer Bank", "description": "Overload jadwal"},
        {"date": d(-5), "name": "Fee fotografer sesi Citra", "category": "Staff/Fotografer", "amount": 600000, "method": "Transfer Bank", "description": "Sesi UPN"},
        {"date": d(-1), "name": "Langganan Adobe CC", "category": "Software", "amount": 300000, "method": "Transfer Bank", "description": "Bulanan"},
    ]
    await db.expenses.insert_many([
        {"id": new_id(), **e, "receipt_url": "", "created_at": now_iso(), "created_by": "Pemilik Studio"}
        for e in expenses
    ])
