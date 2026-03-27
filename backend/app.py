from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import os
import base64
import random

app = Flask(__name__)
CORS(app)

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")
TOKENS_FILE = os.path.join(os.path.dirname(__file__), "tokens.json")

if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)

if not os.path.exists(TOKENS_FILE):
    with open(TOKENS_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def issue_token(email):
    tokens = read_json(TOKENS_FILE)
    raw = f"{email}|{datetime.utcnow().isoformat()}"
    token = base64.urlsafe_b64encode(raw.encode()).decode()
    tokens[token] = {
        "email": email,
        "expires": (datetime.utcnow() + timedelta(hours=12)).isoformat(),
    }
    write_json(TOKENS_FILE, tokens)
    return token


def validate_token(token):
    if not token:
        return None
    tokens = read_json(TOKENS_FILE)
    entry = tokens.get(token)
    if not entry:
        return None
    if datetime.fromisoformat(entry["expires"]) < datetime.utcnow():
        tokens.pop(token, None)
        write_json(TOKENS_FILE, tokens)
        return None
    return entry["email"]


@app.route("/api/signup", methods=["POST"])
def signup():
    payload = request.json or {}
    profile = payload.get("profile")
    password = payload.get("password")
    if not profile or not password or not profile.get("email"):
        return jsonify({"success": False, "message": "Missing fields."}), 400

    users = read_json(USERS_FILE)
    email = profile["email"].lower()
    if email in users:
        return jsonify({"success": False, "message": "User exists."}), 409

    users[email] = {
        "profile": profile,
        "password": password,
    }
    write_json(USERS_FILE, users)
    token = issue_token(email)
    return jsonify({"success": True, "user": profile, "token": token})


@app.route("/api/login", methods=["POST"])
def login():
    payload = request.json or {}
    email = (payload.get("email") or "").lower()
    password = payload.get("password")
    if not email or not password:
        return jsonify({"success": False, "message": "Missing fields."}), 400

    users = read_json(USERS_FILE)
    user_entry = users.get(email)
    if not user_entry or user_entry.get("password") != password:
        return jsonify({"success": False, "message": "Invalid credentials."}), 401

    token = issue_token(email)
    return jsonify({"success": True, "user": user_entry["profile"], "token": token})


@app.route("/api/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    tokens = read_json(TOKENS_FILE)
    tokens.pop(token, None)
    write_json(TOKENS_FILE, tokens)
    return jsonify({"success": True})


@app.route("/api/user", methods=["GET", "PUT"])
def user_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    email = validate_token(token)
    if not email:
        return jsonify({"success": False, "message": "Unauthorized."}), 401

    users = read_json(USERS_FILE)
    entry = users.get(email)
    if not entry:
        return jsonify({"success": False, "message": "User not found."}), 404

    if request.method == "GET":
        return jsonify({"success": True, "user": entry["profile"]})

    profile = request.json or {}
    entry["profile"].update(profile)
    users[email] = entry
    write_json(USERS_FILE, users)
    return jsonify({"success": True, "user": entry["profile"]})


@app.route("/api/predict", methods=["POST"])
def predict():
    payload = request.json or {}
    crop = payload.get("crop") or {}
    n = payload.get("nitrogen", 0)
    p = payload.get("phosphorus", 0)
    k = payload.get("potassium", 0)
    ph = payload.get("ph", 0)

    base = crop.get("baseYield", 2.5) if isinstance(crop, dict) else 2.5
    score = base + (n / 100) * 0.5 + (p / 100) * 0.3 + (k / 100) * 0.25 + max(0, (7 - abs(ph - 6.5)) * 0.15)
    confidence = min(99, 50 + int((n + p + k) / 3))

    ph_clean = round(float(ph), 1) if isinstance(ph, (int, float, str)) and str(ph).replace('.', '', 1).isdigit() else ph
    factors = [
        {"labelKey": "fertilizer_use", "val": n + p + k, "direction": "up", "impact": 12},
        {"labelKey": "soil_ph_balance", "val": ph_clean, "direction": "up", "impact": 10},
        {"labelKey": "weather_condition", "val": "sunny", "direction": "up", "impact": 8},
    ]

    return jsonify({
        "success": True,
        "predictedYield": round(score, 2),
        "unit": "tons/ha",
        "confidence": confidence,
        "factors": factors,
    })


@app.route("/api/disease", methods=["POST"])
def disease():
    payload = request.json or {}
    # In real-world, an ML model would inspect image.
    random_res = random.choice([
        {"diseaseKey": "disease_leaf_blight", "descKey": "disease_leaf_blight_desc", "treatmentKey": "disease_leaf_blight_treatment", "confidence": 87, "severity": "high"},
        {"diseaseKey": "disease_powdery_mildew", "descKey": "disease_powdery_mildew_desc", "treatmentKey": "disease_powdery_mildew_treatment", "confidence": 82, "severity": "medium"},
        {"diseaseKey": "disease_rust", "descKey": "disease_rust_desc", "treatmentKey": "disease_rust_treatment", "confidence": 79, "severity": "medium"},
        {"diseaseKey": "disease_bacterial_wilt", "descKey": "disease_bacterial_wilt_desc", "treatmentKey": "disease_bacterial_wilt_treatment", "confidence": 91, "severity": "high"},
    ])
    return jsonify({"success": True, "result": random_res})


@app.route("/api/recommendations", methods=["GET"])
def recommendations():
    crop = request.args.get("crop", "Wheat")
    recs = [
        {"titleKey": "nutrient_management", "descKey": "recommendation_nutrients", "priority": "high", "category": "soil", "icon": "flask"},
        {"titleKey": "irrigation_tips", "descKey": "recommendation_irrigation", "priority": "medium", "category": "water", "icon": "droplets"},
        {"titleKey": "pest_control", "descKey": "recommendation_pest", "priority": "low", "category": "protection", "icon": "bug"},
    ]
    return jsonify({"success": True, "crop": crop, "recommendations": recs})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
