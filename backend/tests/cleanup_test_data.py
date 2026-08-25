"""Removes TEST_-prefixed data created by the automated suites (safe: prefix-scoped)."""
import asyncio
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")


async def main():
    cli = AsyncIOMotorClient(env["MONGO_URL"])
    db = cli[env["DB_NAME"]]
    bookings = await db.bookings.find({"client_name": {"$regex": "^TEST_"}}, {"_id": 0, "id": 1}).to_list(1000)
    ids = [b["id"] for b in bookings]
    print("test bookings:", len(ids))
    if ids:
        print("payments deleted:", (await db.payments.delete_many({"booking_id": {"$in": ids}})).deleted_count)
        print("notifications deleted:", (await db.notifications.delete_many({"booking_id": {"$in": ids}})).deleted_count)
        print("bookings deleted:", (await db.bookings.delete_many({"id": {"$in": ids}})).deleted_count)
    print("expenses deleted:", (await db.expenses.delete_many({"name": {"$regex": "^TEST_"}})).deleted_count)
    print("users deleted:", (await db.users.delete_many({"email": {"$regex": "^test_foto"}})).deleted_count)
    print("login_attempts deleted:", (await db.login_attempts.delete_many({"identifier": {"$regex": "test_"}})).deleted_count)
    cli.close()


asyncio.run(main())
