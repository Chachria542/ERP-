# GrainTrade ERP — Agency Handover

**Client:** Sudarshan Trading
**Domain:** Agri-commodity (grain) trading, custody, and funding
**Stack (frontend, in-scope for this handover):** React 18 + React Router + Shadcn/UI + Tailwind CSS + Axios
**Live preview:** available (URL provided separately)
**Admin login:** `admin / admin123`

---

## 1. What this product is

GrainTrade ERP digitises the **end-to-end physical flow of grain** through Sudarshan Trading's mandi/yard operations and overlays the **financial flow** (bills, invoices, farmer payments, custody/pledge) on top of it.

A single vehicle entering the yard can become any of the following business events:
- A **purchase from a farmer** (we pay the farmer) → Farmer Payment
- A **bill purchase from a supplier/trader** (we owe the supplier) → Bill Purchase
- A **sale to a customer** (customer owes us), with goods either single-customer or split among multiple customers (Mixed Load) → Sales Invoice
- **Custody / Pledge** stock (we hold goods on behalf of someone, no ownership transfer)

Everything starts from one universal entry point — **Pre-Entry** — and every truck must pass the **Weighbridge** before the financial document is generated.

---

## 2. Mental model in one diagram

```
                 ┌──────────────┐
                 │  PRE-ENTRY   │  (universal — choose entry type)
                 └──────┬───────┘
                        │  generates a "queue item"
                        ▼
                 ┌──────────────┐
                 │ WEIGHBRIDGE  │  (gross/tare/deductions → net weight)
                 └──────┬───────┘
                        │
        ┌───────────────┼─────────────────┬──────────────────┐
        ▼               ▼                 ▼                  ▼
  Farmer Payment   Bill Purchase    Sales Invoice       Custody / Pledge
   (we pay)        (we owe)        (customer owes)     (we hold stock)
```

The same record carries forward through the chain. **Quality, expected bags, rate per qtl** entered at Pre-Entry are inherited downstream. Editing happens only at the right stage.

---

## 3. Modules at a glance

| # | Module | Route | Purpose |
|---|--------|-------|---------|
| 1 | Dashboard | `/` | KPIs + quick links |
| 2 | **Pre-Entry** | `/pre-entry` | Single point of entry for all incoming vehicles. Captures vehicle, party, item, expected qty, rate, quality, entry-type. |
| 3 | **Weighbridge** | `/weighbridge` | Gross weight in / Tare out, deductions, photos (placeholder), generates net weight. |
| 4 | **Bill Purchase** | `/bill-purchase` | Convert weighed entries (purchase type) into supplier bills. Draft → Post. |
| 5 | **Sales Invoice** | `/sales-invoice` | Convert weighed entries (sale type) into customer invoices. Supports **Single Load** and **Mixed Load** (one truck → multiple invoices). |
| 6 | **Farmer Payment** | `/farmer-payment` | Pay farmers for direct purchases — voucher generation & payment tracking. |
| 7 | Custody & Pledge | `/custody` | Goods we hold for others — non-financial stock movement. |
| 8 | Sales (legacy) | `/sales` | Older sales view, kept for reference. |
| 9 | Production | `/production` | Production / processing entries. |
| 10 | Ledger | `/ledger` | Party ledger views. |
| 11 | Master Data | `/master-data` | Customers, Suppliers, Farmers, Brokers, Transporters, Items. |
| 12 | Reports | `/reports` | Operational + financial reports. |
| 13 | Company Settings | `/company-settings` | Company profile, GSTIN, signatories, print header config. |
| 14 | Sales Pre-Entry | `/sales-pre-entry` | (Legacy/alternate) sales-specific pre-entry — superseded by universal Pre-Entry. |

> **Active production flows** the agency should focus on: **Pre-Entry → Weighbridge → (Bill Purchase | Sales Invoice | Farmer Payment)** plus Master Data & Company Settings. The rest is supporting/legacy.

---

## 4. Key concepts the agency must understand

### 4.1 Entry types (chosen at Pre-Entry)
- **Purchase** → goes to Bill Purchase queue
- **Sale (Single Load)** → goes to Sales Invoice queue, becomes 1 invoice
- **Sale (Mixed Load)** → goes to Sales Invoice queue, becomes **N invoices** from 1 weighed truck
- **Farmer Purchase** → goes to Farmer Payment queue
- **Custody** → goes to Custody module (no money movement)

### 4.2 Draft vs Post
Bills and invoices live in **Draft** state until explicitly posted. Drafts are editable. Once **Posted**:
- Document number is locked
- Stock and ledger impact is committed
- Editing is restricted (currently no formal audit log — see KNOWN_ISSUES)

### 4.3 Mixed Load (the trickiest concept)
One physical truck carries goods sold to **multiple customers** in one trip. The system:
1. Captures all customers + their respective bag/qty/rate splits at Pre-Entry.
2. Performs **one weighbridge entry** for the whole truck.
3. Auto-allocates net weight across the customers.
4. Generates **multiple invoices in one bulk action**, plus matching freight slips.
5. Stores the linked invoice numbers in `invoice_numbers[]` on the pre-entry record.

### 4.4 Data inheritance
Once entered at Pre-Entry, these fields **flow downstream automatically** and should not be re-typed:
- `quality`
- `expected_bags`
- `rate_per_qtl`
- party (customer/supplier/farmer)
- vehicle, transporter, broker

### 4.5 Identifiers
The system uses **UUIDs** (not Mongo ObjectIds) for cross-module references. Treat IDs as opaque strings on the frontend.

---

## 5. What's already built (frontend)

- All 14 routes wired in `App.js` with login-guarded navigation.
- Shared sidebar `Layout.js` with active-route highlighting and logout.
- Autocomplete components for Customer / Supplier / Broker / Transporter (typeahead with create-on-the-fly).
- Pre-Entry form with conditional fields per entry type, mixed-load multi-customer rows.
- Weighbridge entry: gross-in / tare-out flow, deductions, net-weight auto-calc, total-weight calc for mixed loads.
- Sales Invoice: full-page Mixed Load processing form (recently redesigned), single-load form, queue with filters (All / Draft / Posted), printable invoice + freight slip templates, multi-print for mixed loads.
- Bill Purchase: draft creation, post action, queue with filters, supplier autocomplete.
- Farmer Payment: voucher entry & queue.
- Master Data CRUD pages.
- Print-friendly templates (use browser print; `print:hidden` / `print:block` Tailwind utilities).

---

## 6. What is **not** built yet (agency to pick up)

P0 (production blockers):
- Secure auth (currently basic JWT, plain password). Migrate to bcrypt + refresh tokens + rate limiting.
- DB transactions around invoice/bill posting (avoid partial writes).
- Audit log for edits/deletes on posted documents.

P1 (functional gaps):
- **Bill Purchase voucher print view** — not yet implemented.
- **Farmer Payment voucher print view** — not yet implemented.
- **S3 (or compatible) storage** for weighbridge photos — currently MOCKED with local placeholders.
- **Pagination + infinite scroll** on queue pages — currently fetches all rows.
- DB indexing pass for query performance.

P2 (nice-to-have):
- Accessibility: a few `<input>` elements lack `id`/`name` attributes (browser autofill warning in console). User explicitly deferred this.
- File-structure refactor: move endpoints to `/app/backend/routes`, models to `/app/backend/models`, split `server.py`.

---

## 7. How to navigate this handover pack

| File | What's inside |
|------|---------------|
| `HANDOVER.md` (this file) | Big picture, modules, scope split |
| `BUSINESS_LOGIC.md` | Every domain rule, calculation, validation, state transition |
| `MODULE_FLOWS.md` | Step-by-step user journeys per module + screen-level flow |
| `FRONTEND_GUIDE.md` | React app structure, routing, components, design system, conventions |

Start with this file → then `BUSINESS_LOGIC.md` → then `MODULE_FLOWS.md` while clicking through the live preview → finally `FRONTEND_GUIDE.md` when you're ready to extend the UI.

---

## 8. Contact / clarifications

For domain questions (what should happen when a farmer brings a wet load, how TCS is calculated for which slab, etc.) — **always confirm with the client**. Documented rules here reflect what is currently implemented; the client owns the source of truth for trade conventions.
