# Farm Vision Pro (Flask + React)

This project is a hybrid frontend React (Vite + Tailwind) app with a new Python Flask backend for authentication and AI features.

## Backend

- Location: `backend/app.py`
- Run:
  - `cd backend`
  - `python -m venv venv` (optional)
  - `venv\Scripts\activate` (Windows)
  - `pip install -r requirements.txt`
  - `python app.py`
- Stores users in `backend/users.json` and token data in `backend/tokens.json`.

## Frontend

- Location: `src/`
- Run:
  - `npm install`
  - `npm run dev`

## Proxy

`vite.config.ts` proxies `/api` requests to `http://localhost:5000`.

## Features

- Auth via `AuthContext` using backend `/api/login`, `/api/signup`, `/api/user`
- Yield prediction `/api/predict`
- Disease detection `/api/disease`
- Farm recommendations `/api/recommendations`
- New design theme in `src/index.css`

# temp
