# POS Platform

Multi-industry POS system — NestJS backend, Vue 3 frontend, Flutter mobile.

---

## Project structure

```
pos-platform/
├── backend/          NestJS API
├── frontend/         Vue 3 + Quasar (Phase 1)
├── mobile/           Flutter (Phase 5)
├── docs/             Architecture docs
├── PHASES.md         Phase-by-phase plan + progress tracker
└── docker-compose.yml
```

---

## Quick start (backend)

### Prerequisites
- Node.js 20+
- Docker + Docker Compose

### 1. Start the database

```bash
docker-compose up -d postgres
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in Firebase credentials and DATABASE_URL
```

### 4. Run in development

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`.

### 5. Run migrations (production)

```bash
npm run migration:run
```

---

## API overview

All routes require `Authorization: Bearer <firebase-id-token>` except `@Public()` routes.

Branch context is passed via the `X-Branch-Id` header.

### Standard response envelope

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Onboarding flow

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/onboarding/business` | Firebase only | Create business + owner (step 2) |
| `POST` | `/onboarding/type` | Firebase + tenant | Set business type (step 3) |
| `POST` | `/onboarding/plan` | Firebase + tenant | Set plan + auto-provision (step 4+5) |
| `GET`  | `/onboarding/status` | Firebase + tenant | Get current step + checklist |
| `PATCH`| `/onboarding/wizard/:step` | Firebase + tenant | Mark wizard step complete |
| `POST` | `/onboarding/draft` | Firebase + tenant | Save partial form state |

### Businesses

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET`  | `/businesses/me` | authenticated | Get own business |
| `PATCH`| `/businesses/me` | `settings.manage` | Update business |

### Branches

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET`  | `/branches` | `branches.view` | List branches |
| `POST` | `/branches` | `branches.manage` | Create branch |
| `PATCH`| `/branches/:id` | `branches.manage` | Update branch |
| `DELETE`| `/branches/:id` | `branches.manage` | Deactivate branch |

### Users

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET`  | `/users` | `users.manage` | List all users |
| `POST` | `/users/invite` | `users.invite` | Invite a user |
| `POST` | `/users/accept-invite/:token` | public | Accept invite |
| `DELETE`| `/users/:id` | `users.manage` | Deactivate user |

### RBAC

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET`  | `/rbac/roles` | `roles.manage` | List roles |
| `POST` | `/rbac/roles` | `roles.manage` | Create custom role |
| `GET`  | `/rbac/permissions` | `roles.manage` | All available permissions |
| `PUT`  | `/rbac/roles/:id/permissions` | `roles.manage` | Set role permissions |
| `POST` | `/rbac/users/:userId/roles/:roleId` | `users.manage` | Assign role to user |

---

## Phase status

See [PHASES.md](./PHASES.md) for full phase-by-phase checklist.

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Planning & architecture | ✅ Done |
| 1 | Foundation (auth, onboarding, RBAC) | 🔨 In progress |
| 2 | POS core | ⬜ Not started |
| 3 | Inventory + contacts + reports | ⬜ Not started |
| 4 | Industry support (retail + restaurant) | ⬜ Not started |
| 5 | Mobile app (Flutter) | ⬜ Not started |
| 6 | Expansion (school + pharmacy) | ⬜ Not started |
| 7 | Advanced features | ⬜ Not started |
