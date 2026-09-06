# Deploy SiNails Studio

This app is **one Node server**: Express API + built React UI + PostgreSQL.

Production never seeds demo users. After deploy, the first visit is **Create Admin Account**.

---

## Recommended: Render + Neon (free)

Railway free trial may be expired. Use this path instead.

### 1. Free Postgres on Neon

1. Open [https://console.neon.tech](https://console.neon.tech) and sign up (GitHub is fine)
2. Create a project named `sinails`
3. Copy the connection string (**DATABASE_URL**) — it should include `sslmode=require`

### 2. Web service on Render

1. Open [https://dashboard.render.com](https://dashboard.render.com) → sign in with GitHub
2. **New** → **Web Service** → select repo **`Si-nails`**
3. Configure:

| Field | Value |
|-------|--------|
| Branch | `main` |
| Runtime | Node |
| Build command | `npm install --include=dev && npx prisma generate && npm run build` |
| Start command | `npm run start:prod` |

4. **Environment** variables:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | paste Neon URL |
| `JWT_SECRET` | long random string (32+ chars) |

5. Click **Create Web Service** and wait for the deploy (first build can take a few minutes)
6. Open your Render URL:

```text
https://YOUR-SERVICE.onrender.com/api/health
→ {"status":"ok",...}

https://YOUR-SERVICE.onrender.com/
→ Create Admin Account
```

### If a previous Blueprint deploy failed

1. Delete the failed **sinails** web service and **sinails-db** (if any) on Render
2. Create a **Web Service** manually with Neon as above (do not rely on free Render Postgres)

### Why the Blueprint failed

- Render often installs **without** `devDependencies` when `NODE_ENV=production`, so `vite` / `typescript` were missing during build
- Free Render Postgres plans are limited / often unavailable

The repo is updated so builds include the tools they need, and DB is expected from Neon.

---

## Alternative: Railway (if you have a paid plan)

1. [railway.app/new](https://railway.app/new) → Deploy from GitHub → `Si-nails`
2. Add **PostgreSQL**
3. Set env vars on the web service:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | reference from Postgres |
| `JWT_SECRET` | long random string |
| `NODE_ENV` | `production` |

4. Generate a public domain → open `/api/health` then `/setup`

Dockerfile + `railway.toml` are already in the repo.

---

## Local production build check

```bash
npm install
npx prisma migrate deploy
npm run build
set NODE_ENV=production
set JWT_SECRET=local-prod-test-secret-change-me
npm start
```

Open `http://localhost:5000`.

---

## After deploy checks

```bash
npm run deploy:check -- https://YOUR-SERVICE.onrender.com
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails: `vite` / `tsc` not found | Use build command with `npm install --include=dev` (already in docs) |
| `DATABASE_URL` missing | Paste Neon connection string into Render env |
| Login cookie fails | Confirm `NODE_ENV=production` and HTTPS URL |
| Setup skipped | An ADMIN already exists — reset that database |
| App sleeps / slow first load | Normal on Render free tier after idle |
