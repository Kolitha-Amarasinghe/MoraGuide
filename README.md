# MoraGuide

MoraGuide is a campus guide for the University of Moratuwa with an Express API and SQLite database. The production backend serves the compiled React frontend.

## Requirements and setup

- Node.js 20+
- SQLite is bundled through the backend dependency; no database server is required.

From the project root, install dependencies and initialize the app:

```powershell
npm install
Copy-Item .\moraguide-backend\.env.example .\moraguide-backend\.env
npm run seed
```

By default, the SQLite database is `Moraguide.sqlite` in the project root. `DATABASE_PATH` in `moraguide-backend/.env` can point to another file. On startup, the backend creates the tables and migrates events from the earlier SQLite schema without removing them.

The `Moraguide.sql` file is a MySQL-style schema reference; the running app uses SQLite and initializes its schema in the backend. Do not execute its `DROP DATABASE` statement against a database containing data.

## Run the app

Development mode starts Vite and Express:

```powershell
npm run dev
```

Open `http://localhost:5173`. To build and serve from Express:

```powershell
npm run build
npm start
```

Then open `http://localhost:3000`. Check `http://localhost:3000/api/health` for database status.

## Accounts and role pages

Students and event organizers can create accounts from **Sign up**. Passwords are stored as bcrypt hashes and login sessions use HTTP-only cookies. Student pages support event registration, saved places, and profile updates. In the Profile section, choose a JPEG, PNG, or WebP image (up to 2 MB), then click **Save profile**; its bytes and content type are stored in SQLite, and the saved photo appears in the dashboard avatar. Organizer pages support event CRUD, attendee lists, and profile updates. Admin accounts are not available through public signup.

The sample SQL password hashes are placeholders and are not usable for login. Students and organizers should sign up through the app; create admins with the script below.

Create an admin account from PowerShell by setting the values for the current terminal session and running the script:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "Use-A-Unique-Password-Here"
npm --prefix moraguide-backend run create-admin
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

Use a unique password with at least 12 characters. The script refuses to overwrite an existing account.

## API overview

- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/profile`
- Places: public `GET /api/places`; student favorites at `/api/places/favorites`
- Events: public `GET /api/events`; organizer event management and student registration require sign-in
- Admin: `/api/admin/summary` and `/api/admin/users` require an admin account
- FAQs and contact messages: `/api/faqs`, `/api/contacts`
- Health: `GET /api/health`

The original single-file prototype remains at `uniboarding_roadmap.html`; the React frontend is under `moraguide-frontend`.
