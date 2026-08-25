# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "owner"}).pretty()
```
Verify: password_hash starts with `$2b$`, unique index on users.email exists.

## Step 2: API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"sayapasuransi@gmail.com","password":"TwinsOwner2026!"}'
curl -b cookies.txt $API/api/auth/me
```
Login should return the user object and set `access_token` + `refresh_token` httpOnly cookies. `/me` returns the same user with the cookies.

## Step 3: Negative Tests
- Wrong password → 401 "Email atau kata sandi salah"
- 5x wrong password → 429 lockout 15 menit
- /api/users tanpa login → 401
- /api/finance/summary sebagai admin → 403
