# Deploy SiNails Studio (Railway)

This app is **one Node server**: Express API + built React UI + PostgreSQL.

Production never seeds demo users. After deploy, the first visit is **Create Admin Account**.

---

## Prerequisites

1. [GitHub](https://github.com) account
2. [Railway](https://railway.app) account
3. This repo pushed to GitHub

---

## 1. Push the code

```bash
git init
git add .
git commit -m "Prepare SiNails for production deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/sinails.git
git push -u origin main
```

Do **not** commit `.env` (it is gitignored).

---

## 2. Create the Railway project

1. Open [railway.app/new](https://railway.app/new)
2. **Deploy from GitHub repo** → select `sinails`
3. Add a database: **New** → **Database** → **PostgreSQL**
4. Open the **web service** (Node app) → **Variables**
5. Add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Click **Add Reference** → Postgres → `DATABASE_URL` |
| `JWT_SECRET` | Generate a long random string (32+ chars) |
| `NODE_ENV` | `production` |

Railway sets `PORT` automatically. Do not hardcode it.

6. This repo includes [`Dockerfile`](Dockerfile) + [`railway.toml`](railway.toml). Railway should build with Docker.
7. Deploy / wait for the build to finish.
8. Open the service → **Settings** → **Networking** → **Generate Domain**

---

## 3. Verify

```text
https://YOUR-APP.up.railway.app/api/health
→ {"status":"ok","service":"SiNails Studio"}

https://YOUR-APP.up.railway.app/
→ redirects to Create Admin Account (/setup)
```

On boot the container runs:

```text
prisma migrate deploy   # creates empty tables
node dist/server/index.js
```

No seed data is created.

---

## 4. Alternative: Render

[`render.yaml`](render.yaml) is included.

1. [dashboard.render.com](https://dashboard.render.com) → New → Blueprint
2. Connect the GitHub repo
3. Apply the blueprint (web + Postgres)
4. Confirm `JWT_SECRET` and `DATABASE_URL`
5. Open the Render URL → `/setup`

---

## 5. Local production build check

```bash
npm ci
npx prisma migrate deploy
npm run build
set NODE_ENV=production
set JWT_SECRET=local-prod-test-secret-change-me
npm start
```

Then open `http://localhost:5000` (single port serves UI + API).

---

## 6. Wipe production data later (optional)

If you need a clean client reset on the live DB:

```bash
# Set DATABASE_URL to the production connection string temporarily
npm run db:reset
```

Or run SQL delete of all rows, then reopen `/setup`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Prisma | Ensure `DATABASE_URL` exists at runtime; migrate runs on start |
| Login cookie fails | Confirm `NODE_ENV=production` and HTTPS domain |
| Setup skipped | An ADMIN already exists — reset DB or delete users |
| Port errors | Let the host inject `PORT`; do not set a fixed private port |
