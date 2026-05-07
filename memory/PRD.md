# Paydone Mobile App – PRD (Product Requirements Document)

> **Project**: Mobile app version of the Paydone.id SaaS (web app at https://github.com/firstboy219/cosger99) – Indonesian debt management & financial freedom app.

## Original Problem Statement
> "saya ingin web saas yang sudah saya build di web ini (repo : cosger99) diimplementasikan ke mobile apps juga, jadi tolong buatkan versi mobile appsnya, main menunya adalah Home (selain dashboard,include fitur input hutang & input penghasilan), Create Strategi (extra payment perbulan, Sinking fund & Pos Allocation), Action Plan, Profile"

## User Choices (verbatim)
- Platform: **React Native (Expo)** — iOS & Android
- Backend: Reuse existing API at **https://api.cosger.com**
- Auth: **JWT-based custom auth** (email + password)
- Design: Free / follow recommendations

## Tech Stack
- **Mobile UI**: Expo SDK 51 + React Native 0.74 + expo-router (file-based routing)
- **State**: React Context (`AppProvider`) with optimistic updates
- **HTTP**: native `fetch` + AsyncStorage for token persistence
- **Backend (reused)**: `https://api.cosger.com` (Node.js + Postgres) — managed externally, NOT inside this codebase

## Architecture
```
/app/frontend/                           # Expo project (mobile app)
├── app.json                             # Expo config
├── babel.config.js
├── metro.config.js
├── package.json
├── tsconfig.json
├── app/
│   ├── _layout.tsx                      # Root: Auth gate + GestureHandler + SafeArea
│   ├── index.tsx                        # Redirect to /(tabs) or /login
│   ├── login.tsx                        # Login screen (email + password)
│   └── (tabs)/
│       ├── _layout.tsx                  # Bottom tab bar
│       ├── index.tsx                    # Home (Dashboard + Hutang + Penghasilan + FAB)
│       ├── strategi.tsx                 # 3-tab Strategi (Extra/Sinking/Pos)
│       ├── action-plan.tsx              # Tasks list + filters
│       └── profile.tsx                  # User profile + logout
└── src/
    ├── theme/index.ts                   # Organic & Earthy palette
    ├── utils/format.ts                  # IDR currency formatters
    ├── services/api.ts                  # fetch + storage + login + CRUD
    ├── contexts/AppContext.tsx          # Auth + data state
    └── components/
        ├── BottomSheet.tsx              # Cross-platform sheet (RN Modal)
        ├── UI.tsx                       # Card, Button, Input, Field, Empty, Chip, StatPill
        ├── InputHutangSheet.tsx         # Modal form for adding debt
        └── InputPenghasilanSheet.tsx    # Modal form for adding income
```

## Implemented Features (✅ shipped)
### 1. Authentication
- Email + password login via `POST /api/auth/login`
- Token persisted in AsyncStorage (`paydone_session_token`, `paydone_active_user`)
- Auto-redirect: unauthenticated → `/login`, authenticated → `/(tabs)`
- Logout from Profile screen → clears storage + back to login

### 2. Home Tab
- Greeting + avatar
- **Hero Dashboard Card**: Total Hutang + DSR ratio (SVG circular ring) + monthly obligation
- **Footer Stats**: Pemasukan/bln + Sisa Cashflow
- **Quick Action buttons**: Input Hutang, Input Penghasilan
- **Recent Hutang list** (4 items) with delete swipe action
- **Recent Penghasilan list** (4 items) with delete
- **FAB Speed Dial**: floating + button → expand → Input Hutang / Input Penghasilan
- **Pull-to-refresh** triggers `/api/sync` re-fetch

### 3. Input Hutang (Bottom Sheet)
- Loan type selector: KPR, Kendaraan, Pinjaman Pribadi, Kartu Kredit, Pendidikan, Bisnis, Lainnya
- Fields: Name, Bank/Kreditur, Pokok Pinjaman, Cicilan/bulan, Tenor, Bunga %, Jatuh Tempo (tgl)
- IDR-formatted currency input with `formatNumberInput`
- POST to `/api/debts` then optimistic add to local state

### 4. Input Penghasilan (Bottom Sheet)
- Type cards: Aktif / Pasif / Bonus (windfall)
- Frequency: Bulanan / Sekali
- Fields: Sumber, Jumlah, Catatan
- POST to `/api/incomes`

### 5. Create Strategi Tab (3 sub-sections)
**a. Extra Payment**
- List active debts
- "Set Extra Payment" sheet → amount + method (`direct_extra` | `sinking_fund`)
- PUT `/api/debts/:id` updates `allocatedExtraBudget` & `payoffMethod`

**b. Sinking Fund**
- 2-column grid of saving jars with progress bar
- "Buat Sinking Fund" sheet → Name + Category (Emergency/Holiday/Gadget/Vehicle/Education/Other) + Target + Deadline
- POST `/api/sinking-funds`

**c. Pos Alokasi (Pos Allocation)**
- Monthly summary card with breakdown bars (Needs / Wants / Debt)
- List of allocations for current month
- "Tambah Pos" sheet → Category + Name + Amount
- POST `/api/allocations` (with `monthKey` = `YYYY-MM`)

### 6. Action Plan Tab
- Stats: Pending / Selesai / Total
- Status filter: Semua / Belum / Selesai
- Category filter: All, Administration, Payment, Negotiation, Investment, Business
- Task list with checkbox toggle (PUT /api/tasks/:id), delete, badge per category
- "Tambah Tugas" sheet → Title, Category, Deadline

### 7. Profile Tab
- Avatar + name + email + role badge
- **Target Kebebasan Finansial** card (dark hero) with progress bar
- 3 quick stats: Sisa Hutang / Tugas Selesai / Sinking Fund
- Akun group: Email, Mata Uang, Status
- Pengaturan group: Sinkronisasi Data (manual sync), API Server, Versi Aplikasi
- Logout button (tomato/danger styled)

## Design System
- Theme: **Organic & Earthy** (light)
- Primary: `#7D8F69` (sage green) · Secondary: `#CD7D5C` (terracotta) · Bg: `#F7F5F0`
- Radii: pill buttons (52–56pt), card 24pt
- Bottom sheets via custom `BottomSheet` (React Native Modal-based, 60fps slide)
- Icons: `@expo/vector-icons` (Ionicons)
- DSR ring: `react-native-svg` Circle with stroke-dasharray

## Current Status
- ✅ Login → Dashboard → Tabs all functional via `api.cosger.com`
- ✅ Web preview running on supervisor `frontend` port 3000 (Expo Web via Metro)
- ✅ Real data loads (3 debts + 2 incomes from u2 test account observed)
- ✅ All 4 tabs render correctly with mobile-friendly UI

## Limitations / Known
- ❗ Admin login flow not implemented (mobile is user-facing only per requirements)
- ❗ Backend has 60s rate limit on auth (5+ failed attempts)
- ❗ Income calculation correctly excludes incomes whose `endDate` has passed (e.g. existing test incomes have `endDate: 2026-02-27` so they're correctly hidden in May 2026)
- ❗ ESLint reports parsing errors on .ts/.tsx files because no TS parser configured — Expo Metro compiles them fine

## Backlog / Future Enhancements
- P1: Native iOS/Android build via EAS (`eas build -p ios|android`)
- P1: Push notifications for due dates (expo-notifications)
- P1: Biometric login (expo-local-authentication)
- P2: Offline-first with cache invalidation
- P2: Charts page (debt amortization, projection) using Victory Native or Skia
- P2: Daily Expenses screen (we already pull dailyExpenses from sync)
- P2: AI Strategist screen (uses backend AI endpoints)

## Smart Enhancement Idea
**Habit-streak gamification**: Award user a daily streak for logging at least 1 expense or marking a task complete. After 7 days the app celebrates and unlocks a "Disiplin Finansial" badge. This drives daily app open rate (the holy-grail metric for finance apps).

## Mobile Build Instructions (for user)
```bash
# Install Expo Go on your phone, then in /app/frontend run:
npx expo start
# Scan the QR code with Expo Go (Android) or Camera (iOS)

# OR build native binaries:
npx eas build -p ios       # produces .ipa
npx eas build -p android   # produces .apk / .aab
```

## Last Updated
2026-05-07 — Initial mobile app MVP completed.

### Iteration 2 (2026-05-07)
- ✅ Fixed CRITICAL bug: `Alert.alert` with multi-buttons was a no-op on react-native-web → introduced `src/utils/confirm.ts` with `confirmAsync()` (window.confirm fallback) and `alertAsync()` (window.alert fallback)
- ✅ Migrated all 6 destructive-action call-sites: Logout (Profile), Delete Debt/Income (Home), Delete Sinking Fund/Pos (Strategi), Delete Task (Action Plan)
- ✅ Migrated all validation alerts in InputHutang/InputPenghasilan/Strategi/ActionPlan to alertAsync
- ✅ Added data-testid attributes to bottom tabs (tab-home, tab-strategi, tab-action-plan, tab-profile)
- ✅ Testing agent retest: 16/16 testable flows PASS, 100% success rate
