from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas

GOLD = colors.HexColor("#C0A080")
INK = colors.HexColor("#0A0A0A")
GREY = colors.HexColor("#6B6B6B")


def rupiah(n):
    return "Rp " + f"{int(n or 0):,}".replace(",", ".")


def pay_label(status):
    return {"lunas": "LUNAS", "dp": "DP TERBAYAR", "belum": "BELUM BAYAR"}.get(status, status or "-").upper()


def build_invoice_pdf(b, biz) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4

    c.setFillColor(INK)
    c.rect(0, H - 42 * mm, W, 42 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(18 * mm, H - 19 * mm, biz["name"].upper())
    c.setFillColor(colors.HexColor("#FAFAFA"))
    c.setFont("Helvetica", 8.5)
    c.drawString(18 * mm, H - 26 * mm, biz["tagline"])
    c.drawString(18 * mm, H - 31 * mm, f"{biz['phone']}  |  {biz['email']}")
    c.drawString(18 * mm, H - 36 * mm, biz["address"])
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 26)
    c.drawRightString(W - 18 * mm, H - 20 * mm, "INVOICE")
    c.setFillColor(colors.HexColor("#FAFAFA"))
    c.setFont("Helvetica", 10)
    c.drawRightString(W - 18 * mm, H - 28 * mm, b["invoice_number"])
    c.drawRightString(W - 18 * mm, H - 34 * mm, f"Tanggal: {b.get('created_at', '')[:10]}")

    y = H - 56 * mm
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, y, "TAGIHAN KEPADA")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(18 * mm, y - 6 * mm, b["client_name"])
    c.setFont("Helvetica", 9.5)
    c.drawString(18 * mm, y - 12 * mm, b.get("phone", ""))
    if b.get("instagram"):
        c.drawString(18 * mm, y - 17 * mm, f"IG: @{b['instagram']}")

    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 18 * mm, y, "STATUS PEMBAYARAN")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(W - 18 * mm, y - 7 * mm, pay_label(b.get("payment_status")))

    y -= 28 * mm
    c.setStrokeColor(colors.HexColor("#E5E5E5"))
    c.setLineWidth(0.6)
    c.line(18 * mm, y, W - 18 * mm, y)
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, y - 5 * mm, "DESKRIPSI")
    c.drawRightString(W - 18 * mm, y - 5 * mm, "JUMLAH")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(18 * mm, y - 12 * mm, b["package"])
    c.drawRightString(W - 18 * mm, y - 12 * mm, rupiah(b["total_price"]))
    c.setFont("Helvetica", 9)
    c.setFillColor(GREY)
    c.drawString(18 * mm, y - 18 * mm, f"Tanggal sesi: {b['booking_date']}  pukul {b['booking_time']}")
    c.drawString(18 * mm, y - 23 * mm, f"Lokasi: {b['location']}")
    y -= 30 * mm
    c.line(18 * mm, y, W - 18 * mm, y)

    rows = [
        ("Total Harga Paket", rupiah(b["total_price"]), False),
        ("DP (Uang Muka)", rupiah(b.get("dp_amount", 0)), False),
        ("Sudah Dibayar", rupiah(b.get("paid_amount", 0)), False),
        ("Sisa Pembayaran", rupiah(b.get("remaining", 0)), True),
    ]
    ty = y - 9 * mm
    for label, val, strong in rows:
        c.setFillColor(INK if strong else GREY)
        c.setFont("Helvetica-Bold" if strong else "Helvetica", 11 if strong else 9.5)
        c.drawRightString(W - 60 * mm, ty, label)
        c.drawRightString(W - 18 * mm, ty, val)
        ty -= 7 * mm

    c.setFillColor(GREY)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, y - 9 * mm, f"Metode pembayaran: {b.get('payment_method') or '-'}")
    c.drawString(18 * mm, y - 14 * mm, f"Batas pembayaran: {b.get('payment_deadline') or '-'}")

    ty -= 8 * mm
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, ty, "SYARAT & KETENTUAN")
    terms = [
        "1. DP yang sudah dibayarkan tidak dapat dikembalikan jika pembatalan dilakukan oleh klien.",
        "2. Pelunasan dilakukan maksimal pada hari pelaksanaan sesi foto.",
        "3. Jadwal ulang (reschedule) dapat dilakukan maksimal H-3 sebelum sesi.",
        "4. File foto final dikirim melalui tautan Google Drive setelah proses editing selesai.",
        "5. Hasil foto hanya digunakan untuk keperluan portofolio studio dengan izin klien.",
    ]
    for t in terms:
        ty -= 5 * mm
        c.drawString(18 * mm, ty, t)

    c.setFillColor(INK)
    c.rect(0, 0, W, 14 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica", 8)
    c.drawCentredString(W / 2, 6 * mm, f"{biz['name']} — Terima kasih atas kepercayaan Anda.")
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
