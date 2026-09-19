# Nairobi Estate — Backend API

Node + Express + MongoDB (Mongoose) REST API for the Nairobi Estate property
marketplace. Pairs with the React frontend in `nairobi-estate-react/`.

---

## 1. Requirements

- **Node.js 18+** (uses native `fetch`, top-level `await`, ES modules)
- **MongoDB** — either local (`mongod`) or a free MongoDB Atlas cluster

---

## 2. Setup

```bash
cd nairobi-estate-server
npm install
cp .env.example .env      # then edit .env
```

Minimum you must set in `.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/nairobi_estate
JWT_SECRET=<a long random string>
CLIENT_URL=http://localhost:5173
```

Generate a good secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Seed demo data (8 live listings, articles, testimonials, a full buyer journey):

```bash
npm run seed           # wipes + reseeds
npm run seed:destroy   # just wipes
```

Run it:

```bash
npm run dev     # nodemon, http://localhost:5000
npm start       # production
```

Check it's alive: `curl http://localhost:5000/api/health`

### Seeded accounts — password `demo1234` for all

| Role | Email |
|------|-------|
| Buyer | `buyer@demo.com` |
| Partner | `partner@demo.com` |
| Partner | `partner2@demo.com` |
| Admin | `admin@demo.com` |

---

## 3. Running frontend + backend together

Keep them as two sibling folders and run two terminals:

```
project-root/
├── nairobi-estate-react/     # frontend  → http://localhost:5173
└── nairobi-estate-server/    # backend   → http://localhost:5000
```

**Terminal 1** — backend:
```bash
cd nairobi-estate-server && npm run dev
```

**Terminal 2** — frontend:
```bash
cd nairobi-estate-react && npm run dev
```

The backend's CORS already allows `http://localhost:5173` with credentials
(set via `CLIENT_URL`; comma-separate for multiple origins).

### Pointing the frontend at the API

Add `nairobi-estate-react/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

Then create `src/lib/api.js` in the frontend:

```js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, { method = "GET", body, isForm } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",                       // sends the httpOnly cookie
    headers: isForm ? {} : { "Content-Type": "application/json" },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
  del: (p, body) => request(p, { method: "DELETE", body }),
  upload: (p, formData) => request(p, { method: "POST", body: formData, isForm: true }),
};
```

Then swap the contexts over — e.g. in `AuthContext.jsx`:

```js
// was: local users array in localStorage
const login = async ({ email, password }) => {
  const { user } = await api.post("/auth/login", { email, password });
  setUser(user);
  return { ok: true, user };
};
const logout = async () => { await api.post("/auth/logout"); setUser(null); };
// on mount: api.get("/auth/me").then(({user}) => setUser(user)).catch(() => setUser(null));
```

Because auth uses an **httpOnly cookie**, you don't store the JWT in JS at all —
just send `credentials: "include"`. (The token is also returned in the response
body if you'd rather use `Authorization: Bearer`.)

**Optional dev proxy** — to avoid CORS entirely, in `vite.config.js`:
```js
server: { proxy: { "/api": "http://localhost:5000" } }
```
then set `VITE_API_URL=/api`.

---

## 4. Architecture

```
src/
├── server.js              entry — validates env, connects DB, starts listening
├── app.js                 Express app: helmet, cors, rate limits, routes
├── config/
│   ├── db.js              Mongoose connection
│   └── constants.js       roles, statuses, business rules
├── models/                12 Mongoose schemas
├── controllers/           11 controllers (request → response)
├── routes/                12 routers + index
├── middleware/
│   ├── auth.js            protect / authorize / optionalAuth
│   ├── error.js           404 + central error handler
│   ├── validate.js        express-validator runner
│   └── upload.js          multer + Cloudinary-or-local storage
├── services/
│   └── notificationService.js   notifications + alert matching
├── utils/                 ApiError, asyncHandler, loan math, tokens, email
└── seed/seed.js           demo data
```

### Data models

`User` · `Property` · `Article` · `Viewing` · `Alert` · `Notification` ·
`Application` · `Lead` · `ContactMessage` · `Consultation` · `Subscriber` ·
`Testimonial`

Pre-qualification, saved homes, and academy progress are embedded on `User`
(they're 1:1 with a buyer and always read alongside them).

---

## 5. Auth & roles

JWT via **httpOnly cookie** *or* `Authorization: Bearer <token>`.

| Middleware | Purpose |
|---|---|
| `protect` | requires a valid session |
| `authorize(...roles)` | restricts to given roles — **the real enforcement point** |
| `optionalAuth` | attaches `req.user` if present, never rejects (used to flag saved listings on public endpoints) |

Rules encoded server-side:

- **Admin accounts can't be self-registered** — `POST /api/auth/register` rejects `role: "admin"` with 403. Admins create staff via `POST /api/admin/users`.
- **Partners can't publish their own listings.** Whatever `status` a partner sends, a new listing is forced to `PENDING APPROVAL`. Only an admin can set `LIVE`.
- **Admins can publish directly**, and their listings are attributed to `Nairobi Estate (Admin)` with `ownerType: "admin"` — never to a partner.
- **Editing a live listing as a partner** sends it back to `PENDING APPROVAL`.
- Passwords are bcrypt-hashed (cost 12) and `select: false` by default.
- `forgot-password` always returns the same response so it can't be used to enumerate accounts.

---

## 6. Business rules (server-side, not trusted from the client)

| Rule | Value | Where |
|---|---|---|
| Max listing price | KES 15,000,000 | `Property` schema max + create guard |
| KMRC max financed | KES 10,500,000 | `utils/loan.js` |
| Minimum deposit | `max(price − 10.5M, 0)` | `minimumDeposit()` |
| Default rate / term | 9.5% / 25 years | `config/constants.js` |
| Affordability | monthly budget = `income × 30% − debt` | `affordability()` |
| Buying costs | stamp 4%, legal 1.5%, valuation 0.25%, registration 0.5% | `buyingCosts()` |

`Property.monthlyPayment` and `Property.minimumDeposit` are **derived on save**
from `price`, so buyers can filter and sort by affordability and the client can
never disagree with the server.

---

## 7. API reference (85 endpoints)

Base URL: `http://localhost:5000/api`

### Auth — `/auth`
| Method | Path | Access |
|---|---|---|
| POST | `/register` | public (buyer/partner only) |
| POST | `/login` | public |
| POST | `/logout` | public |
| POST | `/forgot-password` | public |
| POST | `/reset-password/:token` | public |
| GET | `/me` | any signed-in |
| PATCH | `/me` | any signed-in |
| PATCH | `/password` | any signed-in |

### Properties — `/properties`
| Method | Path | Access |
|---|---|---|
| GET | `/` | public — filters: `location, county, type, intent, minBeds, minPrice, maxPrice, minMonthly, maxMonthly, search, sort, page, limit` |
| GET | `/:slug` | public (non-live only visible to owner/admin) |
| GET | `/similar/:slug` | public |
| GET | `/:id/financing` | public — `?downPayment=&rate=&years=` |
| GET | `/mine` | partner, admin |
| POST | `/` | partner, admin |
| PATCH | `/:id` | owner, admin |
| DELETE | `/:id` | owner, admin |
| POST | `/:id/images` | owner, admin (multipart `images[]`) |
| DELETE | `/:id/images/:publicId` | owner, admin |
| POST | `/:id/enquire` | signed-in → creates a partner Lead |

Sort values: `payment-asc` (default), `payment-desc`, `price-asc`, `price-desc`, `newest`, `popular`.

### Buyer — `/buyer`
| Method | Path |
|---|---|
| GET / POST / DELETE | `/saved-homes`, `/saved-homes/:propertyId` (toggle), bulk delete |
| GET / PATCH / DELETE | `/prequalification` (get, save one answer, reset) |
| POST | `/prequalification/complete` |
| GET | `/recommendations` |
| GET / PATCH | `/academy-progress` |

### Viewings — `/viewings`
`POST /` (book) · `GET /mine` · `GET /partner` · `PATCH /:id` (reschedule) ·
`PATCH /:id/status` (partner confirms) · `DELETE /:id` (cancel)

### Alerts — `/alerts`
`GET /` · `POST /` · `GET /:id/matches` · `PATCH /:id` · `PATCH /:id/toggle` · `DELETE /:id`

### Notifications — `/notifications`
`GET /` (`?unread=true`) · `PATCH /read-all` · `PATCH /:id/read` · `DELETE /:id`

### Applications — `/applications`
`GET /mine` · `POST /` · `GET /:id` · `POST /:id/documents` (multipart `file` + `name`) ·
`PATCH /:id/review` (admin) · `GET /` (admin)

### Articles — `/articles`
`GET /` · `GET /categories` · `GET /:slug` · `POST /:slug/download` ·
`GET /admin/all` (admin) · `POST /` (admin) · `PATCH /:id` (admin) ·
`DELETE /:id` (admin) · `POST /:id/cover` (admin)

### Partner — `/partner`
`GET /dashboard` · `GET /leads` · `PATCH /leads/:id` · `GET /listings/:id/insights`

### Admin — `/admin`
`GET /properties` · `PATCH /properties/:id/status` · `PATCH /properties/:id/flag` ·
`GET /users` · `POST /users` · `PATCH /users/:id` ·
`GET /analytics` · `GET /activity` · `GET /system-health`

### Public — `/public`
`GET /config` · `GET /testimonials` · `POST /contact` · `POST /consultations` ·
`POST /subscribe` · `POST /calculators/{monthly-payment|affordability|rent-vs-buy|deposit|buying-costs}`

---

## 8. Response shapes

Success:
```json
{ "success": true, "data": { } }
```
Paginated:
```json
{ "success": true, "count": 12, "total": 87, "page": 1, "pages": 8, "data": [] }
```
Error:
```json
{ "success": false, "message": "Validation failed",
  "details": [{ "field": "email", "message": "A valid email is required" }] }
```
`stack` is included only when `NODE_ENV !== "production"`.

---

## 9. Security

- `helmet` security headers · `express-mongo-sanitize` (NoSQL injection) · `hpp` (param pollution)
- CORS locked to `CLIENT_URL` with credentials
- Rate limits: 1000/15min global, 20/15min on login, 20/hr register, 10/hr forgot-password
- Uploads capped at 10MB, restricted to jpeg/jpg/png/webp/pdf
- bcrypt cost 12; reset tokens SHA-256 hashed with 15-minute expiry

---

## 10. File uploads

Works with **no configuration** — files land in `./uploads` and are served at
`/uploads/...`. Set the three `CLOUDINARY_*` vars and it switches to Cloudinary
automatically; no code changes. Use Cloudinary (or S3) in production — most
hosts have ephemeral disks.

---

## 11. Email

Optional. Without SMTP configured, emails are logged to the console instead of
sent, so nothing breaks locally. Set `SMTP_*` + `EMAIL_FROM` to send for real.

---

## 12. Deploying

1. Create a MongoDB Atlas cluster; put its URI in `MONGO_URI`.
2. Set `NODE_ENV=production`, a strong `JWT_SECRET`, and `CLIENT_URL` to your deployed frontend origin.
3. Configure Cloudinary for uploads.
4. Deploy to Render / Railway / Fly.io / a VPS (`npm start`).
5. Deploy the frontend (Vercel/Netlify) with `VITE_API_URL` pointing at the API.

In production the auth cookie is set `secure: true; sameSite: none`, so **both
frontend and backend must be served over HTTPS**.

---

## 13. Verification status

- 49/49 modules import cleanly, 85 endpoints registered
- 17/17 business-logic assertions pass (deposit ceiling, affordability, buying costs, amortization, rent-vs-buy)
- `npm audit` — 0 vulnerabilities

The full request/response integration suite couldn't be executed in the build
sandbox because no MongoDB binary was reachable there. Run it yourself once
Mongo is up — `npm run seed`, then exercise the endpoints (curl/Postman) or
point the frontend at it.
