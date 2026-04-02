# POS Platform — Phase-by-Phase Development Plan

## Legend
- ✅ Designed  🔨 In progress  ⬜ Not started

---

## Phase 0 — Planning & Architecture ✅
**Goal:** Lock architecture, schema, module map before writing production code.

### Deliverables
- [x] Product blueprint
- [x] Database schema (Postgres / TypeORM)
- [x] NestJS module structure
- [x] Inventory movements design
- [x] RBAC model
- [x] Onboarding flow
- [ ] Vue 3 frontend structure
- [ ] API contract (OpenAPI spec skeleton)

---

## Phase 1 — Foundation 🔨
**Goal:** Auth, onboarding, business setup, roles & permissions. A user can sign up,
create a business, get provisioned, and log in.

### Backend modules
- [ ] `auth` — Firebase JWT guard, strategy, decorators
- [ ] `common` — TenantContextInterceptor, PermissionsGuard, CurrentUser decorator
- [ ] `businesses` — CRUD, owner model
- [ ] `branches` — CRUD, user-branch assignment
- [ ] `users` — invite flow, created_by, invite_status
- [ ] `rbac` — roles, permissions, RbacSeeder
- [ ] `onboarding` — state machine, provision(), wizard checklist
- [ ] `config` — environment variables, validation
- [ ] `database` — TypeORM setup, all Phase 1 entities

### Database entities (Phase 1)
- [ ] businesses
- [ ] branches
- [ ] users
- [ ] user_branches
- [ ] roles
- [ ] permissions
- [ ] user_roles
- [ ] role_permissions
- [ ] employees
- [ ] onboarding_progress
- [ ] settings

### Frontend (Vue 3 / Quasar)
- [ ] Project scaffold
- [ ] Auth pages (signup, login)
- [ ] Onboarding wizard (7 steps)
- [ ] Business settings page
- [ ] User management page
- [ ] Role & permissions management

### Acceptance criteria
- Owner can sign up → business provisioned automatically
- Owner can invite staff → staff can log in
- Roles and permissions enforced on all routes
- All data scoped by business_id

---

## Phase 2 — POS Core 🔨
**Goal:** A cashier can open a session, ring up items, accept payment, and print a receipt.

### Backend modules
- [ ] `catalog` — items, categories, item_variants
- [ ] `transactions` — transaction engine, transaction_lines
- [ ] `checkout` — checkout.service (atomic sale + inventory deduction)
- [ ] `payments` — payment methods, payment recording
- [ ] `receipts` — receipt generation (PDF / thermal format)
- [ ] `pos-terminals` — terminal management

### Database entities (Phase 2)
- [ ] items
- [ ] categories
- [ ] item_variants
- [ ] transactions
- [ ] transaction_lines
- [ ] payments
- [ ] pos_terminals

### Frontend
- [ ] POS screen (item grid, cart, checkout flow)
- [ ] Payment modal (cash, card, split)
- [ ] Receipt preview / print
- [ ] Open/close POS session

### Acceptance criteria
- Cashier can complete a full sale
- Inventory deducted atomically with transaction
- Receipt generated and printable
- Transaction history viewable

---

## Phase 3 — Core Modules
**Goal:** Inventory management, contacts, and reports are fully operational.

### Backend modules
- [ ] `inventory` — inventory.service, movements, adjustments, transfers
- [ ] `contacts` — customers, unified contact model
- [ ] `reports` — sales summary, inventory report, movement log
- [ ] `dashboard` — KPI aggregations

### Database entities (Phase 3)
- [ ] inventory
- [ ] inventory_movements
- [ ] inventory_adjustments
- [ ] inventory_transfers
- [ ] contacts

### Frontend
- [ ] Inventory list + stock levels
- [ ] Inventory adjustment form (with approval flow)
- [ ] Branch transfer form
- [ ] Contact list + profile
- [ ] Reports: sales, inventory, movements
- [ ] Dashboard with KPIs

### Acceptance criteria
- Inventory tracked per branch with full audit trail
- Adjustments require approval for non-manager roles
- Transfers create paired movements atomically
- Reports exportable to CSV

---

## Phase 4 — Industry Support (Retail + Restaurant)
**Goal:** Retail is fully featured. Restaurant has basic table management.

### Retail additions
- [ ] Barcode scanning (item lookup by barcode)
- [ ] Bundle / composite items
- [ ] Low-stock alerts
- [ ] Supplier / purchase order (basic)

### Restaurant module
- [ ] `industry/restaurant` — tables, table status
- [ ] Table grid view on POS screen
- [ ] Dine-in / takeaway order types
- [ ] Open ticket → merge to transaction

### Database entities (Phase 4)
- [ ] restaurant_tables
- [ ] purchase_orders (basic)
- [ ] purchase_order_lines

### Acceptance criteria
- Retail POS works with barcode scanner
- Restaurant table can be opened, items added, then closed to payment
- Business type controls which UI modules are visible

---

## Phase 5 — Mobile App (Flutter)
**Goal:** iOS + Android POS app with offline-capable checkout.

### Modules
- [ ] Flutter project scaffold
- [ ] Auth (Firebase)
- [ ] POS screen (optimised for tablet / mobile)
- [ ] Checkout + payment
- [ ] Dashboard lite (today's sales)
- [ ] Offline queue — transactions stored locally if no internet, sync on reconnect

### Acceptance criteria
- Full checkout flow works on tablet
- Offline mode queues transactions and syncs
- Dashboard shows today's key numbers

---

## Phase 6 — Expansion (School + Pharmacy)
**Goal:** School fee management and pharmacy inventory live.

### School module
- [ ] `industry/school` — students, programs, fee schedules
- [ ] Student profile + enrollment
- [ ] Fee schedule + billing cycles
- [ ] Payment tracking per student per period
- [ ] Inventory issuance to students

### Pharmacy module
- [ ] Retail POS base (already done in Phase 2–4)
- [ ] Expiry date tracking per batch
- [ ] Batch receiving (purchase → batch)
- [ ] Low-stock + expiry alerts

### Database entities (Phase 6)
- [ ] student_profiles
- [ ] fee_schedules
- [ ] student_fee_payments
- [ ] pharmacy_batches

---

## Phase 7 — Advanced Features
**Goal:** Analytics, loyalty, notifications, supplier management.

- [ ] Advanced analytics (cohorts, trends)
- [ ] Loyalty points system
- [ ] Push notifications (low stock, pending approvals)
- [ ] Supplier management + purchase orders (full)
- [ ] Multi-branch stock optimisation suggestions
- [ ] Scheduled reports via email
- [ ] API rate limiting + usage analytics (for SaaS billing)

---

## Tech Stack Reference

| Layer | Tech |
|---|---|
| Backend | NestJS · Node.js · TypeScript |
| Database | PostgreSQL (Cloud SQL) |
| ORM | TypeORM |
| Auth | Firebase Auth |
| Storage | Google Cloud Storage |
| Deployment | Docker · Cloud Run (GCP) |
| Frontend (web) | Vue 3 · Quasar · TypeScript · Pinia |
| Frontend (mobile) | Flutter (iOS + Android) |
| CI/CD | GitHub Actions (Phase 2+) |
| Validation | Zod (DTOs) |
| Testing | Jest (unit) · Supertest (e2e) |
