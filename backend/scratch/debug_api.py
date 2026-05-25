import requests

BASE_URL = "http://localhost:8000/v1"

try:
    print("Logging in...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"user_id": "ADM-00001", "password": "admin123"})
    print(f"Login Response: {login_res.status_code} - {login_res.text}")
    
    if login_res.status_code == 200:
        token = login_res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("Fetching sections...")
        sections_res = requests.get(f"{BASE_URL}/users/sections", headers=headers)
        print(f"Sections Response: {sections_res.status_code} - {sections_res.text}")
except Exception as e:
    print(f"Error: {e}")
