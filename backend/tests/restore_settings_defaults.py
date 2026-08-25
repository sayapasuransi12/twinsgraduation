"""Restore default packages exactly as seeded (ids, prices, quotas, descriptions)."""
import sys
sys.path.insert(0, "/app/backend/tests")
from conftest import API, login_session

s = login_session("Owner (Pemilik Studio)")
packages = [
    {"id": "bronze", "name": "Paket Bronze", "price": 1500000, "quota": 10,
     "desc": "1 jam sesi studio, 10 foto edit, file digital"},
    {"id": "silver", "name": "Paket Silver", "price": 2500000, "quota": 15,
     "desc": "2 jam sesi, 15 foto edit, 1 lokasi outdoor"},
    {"id": "gold", "name": "Paket Gold", "price": 4000000, "quota": 20,
     "desc": "3 jam sesi, 20 foto edit, 2 lokasi, cetak 10R"},
    {"id": "platinum", "name": "Paket Platinum", "price": 6500000, "quota": 30,
     "desc": "Full day, 30 foto edit, multi lokasi, album premium"},
]
r = s.put(f"{API}/settings/packages", json={"packages": packages}, timeout=30)
print(r.status_code, r.json())
