# SiNails Studio Management System

Full-stack management system for **SiNails Studio** (React + Express + Prisma + PostgreSQL).

## Clean start (local)

Double-click or run:

```bat
start.bat
```

This will:

1. Check `.env`
2. **Reset the database** (unless `KEEP_DATA=1`)
3. Start backend on **http://localhost:5000**
4. Start frontend on **http://localhost:5173**

Then open **http://localhost:5173/setup** and create your first ADMIN account.

Keep existing local data:

```bat
set KEEP_DATA=1 && start.bat
```

## Deploy for a client (online)

See **[DEPLOY.md](DEPLOY.md)** for Railway (recommended) or Render.

After deploy, give the client **[CLIENT_HANDOFF.md](CLIENT_HANDOFF.md)** with the live URL filled in.

Production starts with an **empty database**. First visit → Create Admin Account.

## Roles

| Role | How created | Access |
|------|-------------|--------|
| `ADMIN` | `/setup` (first account) or Admin → Users (max **2** admins) | Full admin dashboard |
| `USER` | Public `/signup` or Admin → Users | Entries + Profile |

- Public signup **always** creates `USER`.
- Backend enforces a maximum of **2 ADMIN** accounts.

## Environment

Copy `.env.example` → `.env`:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret"
NODE_ENV="development"
PORT=5000
```

## Scripts

| Command | Purpose |
|---------|---------|
| `start.bat` | Reset DB (default) + start frontend/backend |
| `npm run db:reset` | Clear all data (keep schema) |
| `npm run check:env` | Validate required env vars |
| `npm run dev` | Dev mode (no auto-reset) |
| `npm run build` / `npm start` | Production build / run |
| `npm run start:prod` | Migrate + start (hosting) |

## License

Private — for SiNails Studio use.
