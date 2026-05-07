# Paydone Mobile App - Test Credentials

## Backend API
- **Production API Base URL**: `https://api.cosger.com`
- **Auth endpoint**: `POST /api/auth/login` with body `{ "email": "...", "password": "..." }`
- **Auth response**: returns `user.sessionToken` (camelCase) — this is the active session token used for subsequent requests
- **Required headers** for authenticated requests:
  - `x-user-id: <user.id>`
  - `x-session-token: <sessionToken>`
  - `Authorization: Bearer <sessionToken>`

## Test Accounts (existing on api.cosger.com production database)
| Role | Email              | Password | User ID | Notes                                 |
|------|--------------------|----------|---------|---------------------------------------|
| user | user@paydone.id    | user     | u2      | Has 3 debts + 2 incomes pre-seeded    |
| admin| (admin/123456 per user — but admin login must use email; admin email unknown — has not been verified via curl) | 123456 | (unknown) | Mobile app focuses on user role; admin not used in mobile |

⚠️ Mobile app uses **email + password** login (the same email-based auth as the web app). The web/mobile login form labels the field "Email" and sends it as `{ email, password }`.

## Backend has rate limiting
- After ~5 failed attempts: backend returns `"Terlalu banyak percobaan. Coba lagi dalam 1 menit."` → wait 60s then retry.

## Mobile App Auto-Fill (for QA)
- Login screen pre-fills: `user@paydone.id` / `user`
- Just click **Masuk** to login as test user.

## Endpoints used by Mobile App
- `POST /api/auth/login` — login
- `GET  /api/sync?userId=<id>` — bulk fetch all user data (debts, incomes, sinkingFunds, allocations, tasks, etc.)
- `POST /api/debts` · `PUT /api/debts/:id` — create / update debt
- `POST /api/incomes` · `PUT /api/incomes/:id`
- `POST /api/sinking-funds` · `PUT /api/sinking-funds/:id`
- `POST /api/allocations` · `PUT /api/allocations/:id`
- `POST /api/tasks` · `PUT /api/tasks/:id`
- `DELETE /api/sync/<table>/<id>` — secure delete (table = `debts`, `incomes`, `sinking_funds`, `allocations`, `tasks`)
