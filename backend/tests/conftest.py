import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


def _creds(role_heading):
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    block = content.split(f"## {role_heading}")[1]
    email = re.search(r"Email:\s*([^\s]+)", block).group(1)
    password = re.search(r"Password:\s*([^\s]+)", block).group(1)
    return {"email": email, "password": password}


def login_session(role_heading):
    creds = _creds(role_heading)
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {role_heading}: {r.status_code} {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def owner():
    return login_session("Owner (Pemilik Studio)")


@pytest.fixture(scope="module")
def admin():
    return login_session("Admin")


@pytest.fixture(scope="module")
def photographer():
    return login_session("Fotografer")


@pytest.fixture(scope="module")
def anon():
    return requests.Session()
