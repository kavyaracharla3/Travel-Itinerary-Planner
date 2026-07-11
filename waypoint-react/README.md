# 🧭 Waypoint — Travel Itinerary Planner (React + server.cjs + MongoDB Atlas)

A full-stack travel itinerary planner. React (Create React App) frontend,
a single-file Node/Express backend (`server.cjs`), and **MongoDB Atlas** as
the database.

## ✨ Features

- **Accounts** — register / log in (JWT auth, hashed passwords)
- **Save trips** — every trip is saved to your account in MongoDB
- **Live weather** — real forecast for your destination and travel dates (Open-Meteo, keyless)
- **Interactive map** — auto-located destination pin (Leaflet + OpenStreetMap, keyless)
- **Day-by-day itinerary** — add/remove timed activities per day
- **Budget tracker** — log expenses by category, animated progress bar
- **Polished UI** — passport-stamp branding, boarding-pass trip cards, scroll reveals, hover motion, fully responsive

## 🛠️ Tech stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 (Create React App), `App.jsx` + `App.css`, Leaflet.js |
| Backend   | Node.js + Express, single file: `server.cjs` |
| Database  | **MongoDB Atlas** (via Mongoose) |
| Auth      | JWT + bcrypt |
| Weather   | Open-Meteo API (free, keyless) |
| Geocoding | Open-Meteo Geocoding API (free, keyless) |

## 📁 Project structure

```
waypoint-react/
├── server.cjs           ← the entire backend (Express, auth, trips API, MongoDB models)
├── .env.example          ← copy to .env and fill in your Atlas connection string
├── package.json          ← backend dependencies
└── client/                ← the React app (Create React App)
    ├── package.json       ← frontend dependencies (proxies API calls to :4000)
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.jsx          ← the entire frontend (all components)
        └── App.css           ← all styling
```

## 🗄️ Step 1 — connect MongoDB Atlas

1. In MongoDB Atlas, go to your cluster → **Connect** → **Drivers** → make sure **Node.js** is selected.
2. Copy the connection string it gives you. It looks like:
   ```
   mongodb+srv://<user>:<db_password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
   ```
3. In this project's root folder, copy `.env.example` to a new file named **`.env`**.
4. Paste your connection string into `MONGODB_URI`, replacing `<db_password>` with your actual database user password.
   - Tip: add a database name right before the `?`, e.g. `.../waypoint?appName=Cluster0`, so your data lands in a database called `waypoint` instead of the default.
5. In Atlas, go to **Network Access** and make sure your current IP address is allowed (or add `0.0.0.0/0` while developing, to allow from anywhere).

Your `.env` should look like:
```
MONGODB_URI=mongodb+srv://kavyaracharla641_db_user:yourRealPassword@cluster0.s0grutv.mongodb.net/waypoint?appName=Cluster0
JWT_SECRET=some-long-random-string
PORT=4000
```

**Never commit `.env`** — it's already listed in `.gitignore`.

## 🚀 Step 2 — run it

You'll run **two terminals**: one for the backend, one for the React dev server.

**Terminal 1 — backend**
```bash
cd waypoint-react
npm install
npm start
```
You should see `✅ Connected to MongoDB Atlas` in the terminal, then the API starts on **http://localhost:4000**.

**Terminal 2 — frontend**
```bash
cd waypoint-react/client
npm install
npm start
```
This opens the React app on **http://localhost:3000** and automatically
proxies `/api/...` calls to the backend on port 4000 (already configured
via `"proxy"` in `client/package.json`).

> Open **http://localhost:3000** — that's the app. Port 4000 is API-only.

### Requirements
- Node.js 16 or newer (check with `node -v`)
- A MongoDB Atlas cluster (free tier works) with your `.env` filled in
- Internet access in the browser (for the weather API, map tiles, fonts, and destination photos)

## 📦 Building for production

```bash
cd client
npm run build
cd ..
npm start
```
With a `client/build` folder present, `server.cjs` will serve the built
React app directly from **http://localhost:4000** — no separate frontend
server needed in production.

## 🧪 Quick walkthrough for a demo

1. Click **Get started** → create an account (this writes a document to your MongoDB `users` collection).
2. Click **New trip** → type a city (autocomplete suggests real cities) → pick dates and a budget → **Create itinerary**.
3. On the trip page: add activities under **Itinerary**, check **Map & weather** for the live forecast and pin, log expenses under **Budget** and watch the progress bar animate.
4. Go back to **My trips** to see the boarding-pass card for everything you've planned. Refresh the page — it's all still there, because it's saved in MongoDB.

## 🩹 Troubleshooting

- **`❌ Missing MONGODB_URI`** — you haven't created `.env` yet, or it's not in the same folder as `server.cjs`. Copy `.env.example` to `.env` in the project root.
- **`❌ MongoDB connection failed`** — usually one of: wrong password in the connection string, your IP isn't whitelisted in Atlas → Network Access, or the cluster is paused.
- **Blank page / "Cannot GET /"** — you opened port 4000 without building the client first. During development, use port **3000** (`npm start` inside `client/`).
- **API calls fail with a CORS error** — make sure you're using `localhost:3000` (which proxies to the backend), not opening `client/build` directly.
- **Port already in use** — set a different port in `.env` (`PORT=5000`), or `PORT=3001 npm start` inside `client/` for the frontend.
- **Map markers invisible** — this is a known Leaflet + Webpack quirk; it's already fixed in `App.jsx` by pointing the default marker icons at the bundled image assets.
- **Login says "session expired" immediately** — you likely restarted the backend without a fixed `JWT_SECRET` in `.env`, so old tokens stop working; just log in again.

## 📄 License

Free to use for learning, coursework, or your own projects.
