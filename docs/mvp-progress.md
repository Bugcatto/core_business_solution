# MVP Progress — Master Log

_Last updated: 2026-04-01 | Mode: PM Orchestrator_

---

## Current MVP Goal
Enable first successful POS transaction end-to-end:
Sign up → Onboard business → Add product → Complete sale with inventory deduction.

---

## Current System Snapshot

### Backend Modules
| Module | Status |
|---|---|
| auth (Firebase guards) | ✅ Done |
| businesses | ✅ Done |
| branches | ✅ Done |
| users (invite flow) | ✅ Done |
| rbac (roles, permissions, seeder) | ✅ Done |
| onboarding (7-step state machine) | ✅ Done |
| catalog (items, categories, variants) | ✅ Done |
| transactions (checkout, payment, receipt) | ✅ Done |
| inventory (stock, movements, adjustments, transfers) | ✅ Done |
| pos-terminals | ✅ Done |
| contacts / hr / reports | ⬜ Stubs only |

### Frontend
| Area | Status |
|---|---|
| Firebase auth store (email + Google login) | ✅ Done |
| Tenant store (localStorage persistence) | ✅ Done |
| Router + auth guards + onboarding redirect | ✅ Done |
| Login page | ✅ Done |
| Onboarding wizard (5 steps) | ✅ Done |
| Dashboard page | ✅ Done |
| Items list + form pages | ✅ Done |
| POS page (header, product grid, cart, payment, receipt) | ✅ Done |
| Axios client (auth headers, token refresh, envelope unwrap) | ✅ Done |
| Staff invite page | ❌ Missing |

---

## Completed Tasks

- **[Cycle 1]** DB setup instructions provided — PostgreSQL 15 native install on Windows (user action pending)
- **[Cycle 2a — Backend]** `provision()` now returns `defaultTerminalId` in response
- **[Cycle 2a — Backend]** `kpay` added to `CheckoutPaymentSchema` enum and `PaymentMethod` type alias
- **[Cycle 2b — Frontend]** Checkout payload transformed at API boundary: `terminalId→posTerminalId`, `items→lines`, `payment→payments[]`
- **[Cycle 2b — Frontend]** `terminalId` now stored in tenant store after onboarding provision

---

## Remaining Gaps

| # | Issue | Severity |
|---|---|---|
| 1 | PostgreSQL 16 running, DB connected ✅ | ~~BLOCKER~~ Resolved |
| 2 | Offline queue replay still uses old checkout payload shape | **BUG** (post-MVP risk) |
| 3 | Staff invite UI page missing | **MVP FEATURE** |
| 4 | `alreadyProvisioned` guard path doesn't return `defaultTerminalId` | **EDGE CASE** |

---

## Decisions Made
- Monolithic NestJS backend, shared schema multi-tenancy
- Firebase Auth only, Zod validation
- `kpay` treated as a first-class payment method (not mapped to `qr`)
- Checkout payload transform at API call boundary, not in store types
- PostgreSQL native install (no Docker, no WSL)

## Assumptions
- SME target: non-technical owner, 1–5 staff, Android tablet
- Self-service onboarding only
- Industry behavior via config

## Risks / Blockers
- Offline queue replay payload mismatch (deferred post-MVP)

## Next Steps (Cycle 3)
1. Add staff invite UI page (missing MVP feature)
2. Fix `alreadyProvisioned` guard to also return `defaultTerminalId`
3. Fix offline queue replay payload transform
