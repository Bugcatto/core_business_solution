# Platform Progress Log

> Single source of truth for project state.
> Product: Modular SME Operations Platform — POS is one module, not the center.

---

## Strategic Baseline (Locked 2026-04-02)

**Product Identity:** Modular SME operations platform. Not a POS app.
**Position:** Between basic POS tools (too limited) and full ERP (too heavy/expensive).
**Architecture:** Four-layer — Platform Owner → Business → Operational Unit → Module.
**Commercial model:** Base + per business + per module + per branch + per staff + usage.

---

## Four-Layer Principle (Non-Negotiable)

| Layer | What it means |
|---|---|
| Platform Owner | Top-level account. Owns 1–N businesses. Manages subscriptions and module activation. |
| Business | Operational container. Isolated data boundary. Has lifecycle states. |
| Operational Unit | Branch, terminal, warehouse, dept. Access narrows here. |
| Module | POS, Inventory, Reports, HR, etc. Enabled per business. Gates routes + permissions + UI. |

---

## Current Build Status

### What Works (Phase 1–2)
| Area | Status |
|---|---|
| Email + password auth | ✅ |
| Google OAuth | ✅ |
| Session persistence + token refresh | ✅ |
| Owner onboarding wizard (5-step) | ✅ |
| Auto-provision: branch, roles, terminal, settings | ✅ |
| Catalog CRUD (items, categories, SKU) | ✅ |
| POS terminal — product grid, cart, payment, receipt | ✅ |
| Offline queue + auto-flush | ✅ |
| Staff invite + accept + reactivate flow | ✅ |
| Cross-business invite (UID reuse) | ✅ |
| Role-based permission guard (OR logic) | ✅ |
| Tablet responsive layout | ✅ |

### Known Gaps in Current Build
| Gap | Impact |
|---|---|
| No Platform Owner layer — 1:1 Firebase↔Business | Blocks multi-business. Foundational conflict. |
| No module enablement guard — POS always on | Breaks modular architecture. Foundational conflict. |
| RBAC is role-only — no module or terminal scope | Incomplete access control. Foundational conflict. |
| Dashboard shows placeholder data — not real | Poor owner experience |
| No transaction history view | Missing basic operational need |
| No settings page UI | Receipt, tax, currency not configurable |
| No branch management UI | Can't add/edit branches after onboarding |
| No audit trail | Required for operations and compliance |
| Business lifecycle states incomplete | Only onboarding/active/suspended/cancelled |
| No billing-aware entitlement tracking | Blocks commercial model |

---

## Foundational Architecture Sprint (In Planning)

### Goal
Correct the three structural conflicts before any further feature work.
Nothing built on top of the current foundation is fully correct until these are resolved.

### Sprint Deliverables

---

#### Sprint 1 — Platform Owner Layer

**Why first:** Everything else depends on it. Multi-business, owner dashboard, billing — all blocked without this.

**Backend tasks:**
- [ ] New `platform_owners` table: `id`, `firebaseUid`, `email`, `displayName`, `createdAt`
- [ ] Add `platformOwnerId` FK to `businesses` table
- [ ] New `platform` NestJS module with `PlatformOwnerService`, `PlatformController`
- [ ] Split onboarding: Step 1 creates `PlatformOwner` (not Business). Business creation is a separate subsequent action.
- [ ] Remove one-business-per-Firebase-account constraint from onboarding
- [ ] `TenantMiddleware` updated: Firebase UID → PlatformOwner → resolve Business from `X-Business-Id` header (or default to first active business)
- [ ] `TenantContext` extended with `platformOwnerId`
- [ ] `GET /platform/me` — returns platform owner profile + list of owned businesses
- [ ] `POST /platform/businesses` — create a new business under the platform owner
- [ ] Migrate existing data: create PlatformOwner records for existing business owners

**Frontend tasks:**
- [ ] New Platform Owner Dashboard page (`/owner`) — lists owned businesses, status, module badges
- [ ] Business selector — after login, if owner has multiple businesses, show selector before entering business context
- [ ] Onboarding split: account creation step → then business creation step
- [ ] Store: add `platformOwnerId` to tenant store; add `X-Business-Id` to API headers

**Data migration:**
- Existing Users who are business owners → create a PlatformOwner record with their Firebase UID
- Set `businesses.platformOwnerId` for all existing businesses

---

#### Sprint 2 — Module Enablement Guard

**Why second:** Every route, guard, and UI element must know which modules are enabled. Without this, modular billing and module-based UX are impossible.

**Backend tasks:**
- [ ] New `business_modules` table: `id`, `businessId`, `moduleCode`, `status` (trial/active/paused/disabled), `enabledAt`, `trialEndsAt`
- [ ] Seed default modules on business provision (e.g. `pos` = trial, others = disabled)
- [ ] New `@RequireModule('pos')` decorator
- [ ] New `ModuleGuard` — reads enabled modules from `BusinessModule`, blocks if not active/trial
- [ ] Apply `@RequireModule` to all module controllers: `pos`, `inventory`, `catalog`, `reports`, `hr`
- [ ] `TenantContext` extended with `enabledModules: string[]`
- [ ] `GET /platform/businesses/:id/modules` — list module states for a business
- [ ] `PATCH /platform/businesses/:id/modules/:moduleCode` — enable/disable a module

**Frontend tasks:**
- [ ] Module-aware navigation — only show nav items for enabled modules
- [ ] Module status visible on owner dashboard per business
- [ ] Enable/disable module UI on business settings (owner only)

---

#### Sprint 3 — Owner Dashboard + Real Data

**Why third:** Platform owner needs meaningful visibility to manage businesses. Dashboard currently shows placeholder data.

**Backend tasks:**
- [ ] `GET /platform/me/summary` — across all owned businesses: total transactions today, active staff count, module usage
- [ ] `GET /businesses/:id/dashboard` — real data: today's sales, transaction count, top items, recent activity
- [ ] Wire up from existing transaction + item data

**Frontend tasks:**
- [ ] Platform Owner Dashboard — real business cards with live data
- [ ] Business Dashboard — wire up today's sales, transactions, top items from real API
- [ ] Remove placeholder/hardcoded dashboard values

---

### Sprint Dependencies

```
Sprint 1 (Platform Owner) 
    ↓ must complete first
Sprint 2 (Module Enablement)
    ↓ must complete second
Sprint 3 (Owner Dashboard + Real Data)
    ↓ can partially run in parallel with Sprint 2
```

### What Is NOT in This Sprint
- Advanced RBAC (Role + Scope + Module) — planned after sprint
- Audit trail — planned after sprint
- Billing/subscription tables — architecture anticipates it; implementation deferred
- Settings UI, branch management UI — Phase 3
- New modules (HR, Procurement, Finance) — Phase 3

---

## Decisions Made (Strategic)

| Decision | Rationale |
|---|---|
| Modular SME platform, not POS app | Product identity. POS is one module. |
| Platform Owner layer above businesses | Enables multi-business, billing, lifecycle management |
| Module enablement gates routes + UI | Modular adoption, clean billing boundaries |
| RBAC → Role + Scope + Module (phased) | Access must answer: which business, which branch, which module |
| Business lifecycle states | Draft → active → paused → suspended → archived → closed |
| Billing model: base + per-business + per-module + per-branch + per-staff + usage | Commercial architecture, not cosmetic concern |
| Phone number login | Deferred to Phase 3 |
| Role-based post-login routing | Deferred to Phase 3 |
| Flutter mobile app | Phase 4 |

---

## Deferred to Phase 3

- Reporting module (daily summary, financial reports, export)
- Settings page (tax rate, receipt customization, currency)
- Branch management UI
- HR module (employee records, shifts)
- Contacts module (customer profiles, loyalty)
- Advanced inventory (adjustments, transfers, opening stock UI)
- Advanced RBAC (terminal-level scope, financial visibility dimension)
- Audit trail UI
- Billing / subscription management UI
- Multi-branch switching UI
- Phone number login

---

## Phase 4

- Mobile Flutter app (iOS + Android)

---

## Completed Work (2026-04-03)

### Bug Fixes
| Fix | Files changed |
|-----|--------------|
| Owner dashboard nav never rendered (`<!--v-if-->`) | `tenant.store.ts` — added `isHydrated` ref; `router/guards.ts` — guard now uses `isHydrated` instead of broken double-null check |
| First item in onboarding never saved | `OnboardingPage.vue` — wired `itemsApi.create()` in `submitOnboarding()` |
| Cold-start race condition on `/platform/me` | `OnboardingPage.vue` — sets `platformOwnerId` directly from `createBusiness` response; no longer depends on `getProfile()` succeeding |

### Baseline Migration (2026-04-03)
- Created `backend/src/database/migrations/20260101000000-InitialSchema.ts`
- Captures full schema (24 tables, enum, extension) — runs first on any fresh database
- All 4 migrations recorded in `migrations` table; `migration:run` → "No migrations are pending"
- Fresh machine setup: `createdb pos_platform && npm run migration:run` → complete schema, no manual steps
- `synchronize: true` remains gated to `NODE_ENV=development` for local dev convenience

### Pre-Pilot Blocker Status
| Blocker | Status |
|---------|--------|
| Owner dashboard navigation broken | ✅ Fixed |
| First item in onboarding not saved | ✅ Fixed |
| Baseline migration | ✅ Done |
| Email sending service decision | ❌ Not decided — blocks HR/staff invite work |

---

## Phase 3 Build Order (Confirmed by Owner)
1. Transaction enhancements (refunds UX, receipts, discounts)
2. HR module
3. Reports module

### Email Service Decision (2026-04-03)
- **Resend** chosen for all email sending
- Covers: staff invite emails + tenant onboarding confirmation
- Required before HR module work begins

---

## Phase 3 — Transaction Enhancements Scope (2026-04-03)

### Backend — Already complete
All transaction backend endpoints exist and are working:
- Checkout, list, detail, daily summary, receipt (JSON + thermal text), void, refund

### Frontend — Gaps to build

| # | Gap | Size | Notes |
|---|-----|------|-------|
| 1 | Discount input UI on CartPanel | Small | `setDiscount()` in store exists, display exists — just no button to enter amount |
| 2 | Transaction history page (`/transactions`) | Medium | Route missing entirely. Needs list + date/status filter |
| 3 | Transaction detail view (lines, payments, totals) | Medium | Part of history page — drill-in from list |
| 4 | Void UI (manager only, with reason) | Small | Triggered from detail view; call `transactionsApi.void()` |
| 5 | Refund UI — line-level quantity selection | Medium | Dialog from detail view; `transactionsApi.refund()` payload is wrong — fix to send `{ lines, reason, paymentMethod }` |
| 6 | Receipt print — print only receipt, not full page | Small | `window.print()` prints whole page; add print CSS or open printable popup |

### Build order
1. Discount input UI (unblocked, small, high cashier value)
2. Transaction history page + detail view (needed before void/refund UI can live anywhere)
3. Void + Refund UI (build after detail view exists)
4. Receipt print fix (can be done anytime)

---

## Risks / Known Limitations (Carry Forward)

- `generateTxnNumber` uses total transaction count — not race-safe at high volume (fix: DB sequence)
- Offline queue retries silently fail on business logic errors (not just network errors)
- Existing data has 1:1 Firebase↔Business — migration needed in Sprint 1
- Opening stock in onboarding: no UI step, no API call — deferred to Phase 3 inventory first-run
- No email service configured — staff invite flow is blocked until this is decided
