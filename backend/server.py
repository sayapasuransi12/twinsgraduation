import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from database import db, client
from auth import router as auth_router, seed_owner
from bookings import router as bookings_router
from ops import router as ops_router
from seed import seed_all

app = FastAPI(title="Twins Graduation API")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.bookings.create_index("id", unique=True)
    await db.bookings.create_index("portal_token", unique=True)
    await db.bookings.create_index("booking_date")
    await db.payments.create_index("booking_id")
    await db.expenses.create_index("date")
    await db.notifications.create_index("created_at")
    await db.login_attempts.create_index("identifier")
    await seed_owner()
    await seed_all()


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(ops_router, prefix="/api")

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
