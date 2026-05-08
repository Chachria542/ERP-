# Module Flows — Step by Step

Use this document side-by-side with the live preview. Each flow lists the **screens, actions, and resulting states** so the agency can reproduce them and design future changes confidently.

Login: `admin / admin123`

---

## Flow A — Single Load Sale (most common)

**Goal:** A truck arrives, goods are sold to one customer, an invoice is generated.

1. **Pre-Entry** (`/pre-entry`)
   - Click `+ New Pre-Entry`.
   - Entry Type → `Sale (Single Load)`.
   - Fill: vehicle no., customer (autocomplete), item, quality, expected bags, rate per Qtl, transporter (optional), broker (optional).
   - Submit → row appears in queue with status `Pending Weighbridge`.

2. **Weighbridge** (`/weighbridge`)
   - Find the vehicle in `Awaiting Gross-In`.
   - Capture gross weight + (mock) photo → status moves to `Awaiting Tare-Out`.
   - When truck returns empty: capture tare weight + (mock) photo, set deductions.
   - System computes net weight (kg & qtl) → status `Weighed`.

3. **Sales Invoice** (`/sales-invoice`)
   - Vehicle now appears in queue with status `Draft-ready`.
   - Open the entry → all inherited fields (quality, bags, rate, customer) are pre-filled.
   - Add freight/hamali/other charges if applicable; tax & TCS auto-applied.
   - Save as `Draft` (editable) or `Post` (locks invoice number).
   - From `Posted` row → click `Print` to render invoice + freight slip.

---

## Flow B — Mixed Load Sale (one truck, multiple customers)

**Goal:** A truck contains goods for several customers; produce one invoice per customer in one shot.

1. **Pre-Entry**
   - Entry Type → `Sale (Mixed Load)`.
   - Fill vehicle + transporter + item + quality.
   - Click `+ Add Customer Line` for each customer; per line: customer, bags, item rate.
   - Frontend payload includes `is_mixed_load=true`, `total_invoices=N`, and an `invoice_numbers[]` placeholder.
   - Submit → single queue item flagged "Mixed".

2. **Weighbridge**
   - Single weighbridge entry for the whole truck (gross/tare/deductions).
   - Form shows `Total Expected Weight` (auto-sum across all lines) for sanity check.
   - On save → net weight is computed for the whole truck.

3. **Sales Invoice — Mixed Load processing page** (`/sales-invoice` → open mixed entry)
   - Full-page form (recently redesigned) shows:
     - Header: vehicle, weigh data, total net qtl
     - Per-customer rows with allocated qtl (pro-rata to bags), editable rate, freight share, tax %
     - Summary block: per-customer sub-total/tax/TCS/grand total + grand total of totals
   - Click `Generate All Invoices` → bulk-create endpoint runs:
     - Generates N invoice numbers
     - Stores `invoice_numbers[]` back on the pre-entry record
   - Click `Print` → opens preview with all N invoices + N freight slips for one print job.

---

## Flow C — Bill Purchase (we buy from a supplier/trader)

1. **Pre-Entry** → Entry Type `Purchase`, fill supplier, item, quality, bags, rate per Qtl.
2. **Weighbridge** → standard gross/tare/deductions.
3. **Bill Purchase** (`/bill-purchase`) → entry appears in queue; open it.
   - Inherited fields are pre-filled.
   - Add freight/hamali/other charges, confirm tax/TCS.
   - Save as `Draft` or `Post`.
4. **(Pending)** Print voucher — to be implemented.

Queue filters: `All`, `Draft`, `Posted`.

---

## Flow D — Farmer Payment (direct purchase from farmer)

1. **Pre-Entry** → Entry Type `Farmer Purchase`, fill farmer, item, quality, bags, rate.
2. **Weighbridge** → standard.
3. **Farmer Payment** (`/farmer-payment`) → open the entry:
   - Confirm net qtl × rate.
   - Apply deductions (advances, etc.).
   - Choose payment mode (Cash / Bank / UPI), capture reference.
   - Post voucher.
4. **(Pending)** Print voucher — to be implemented.

---

## Flow E — Custody / Pledge

1. **Pre-Entry** → Entry Type `Custody`. Fill party, item, qty.
2. **Weighbridge** → standard.
3. **Custody** (`/custody`) → record `In` movement (we receive); later `Out` movement (we release).
   - No financial document generated.

---

## Flow F — Master Data management

`/master-data` — tabbed CRUD for Customers, Suppliers, Farmers, Brokers, Transporters, Items.
- Used directly when curating data, but most masters can also be **created inline** via autocomplete dropdowns in transaction forms (the `+ Create new …` row at the bottom of the dropdown).

---

## Flow G — Company Settings

`/company-settings` — captures company GSTIN, address, signatory name, bank details, print header logo. All print templates pull from here.

---

## Flow H — Reports

`/reports` — operational + financial summaries (sales, purchases, payments, ledgers). Uses the same data the modules write.

---

## Status badges across queues

| Badge | Meaning |
|-------|---------|
| Pending Weighbridge | Created at Pre-Entry, awaiting gross-in |
| Awaiting Tare-Out | Gross captured, truck not yet emptied |
| Weighed | Net weight computed, ready for downstream document |
| Draft | Document created but not posted; editable |
| Posted | Document finalised; number locked, print-ready |

---

## Print behaviour

- All printable views use the browser's native `Ctrl/Cmd + P` flow.
- Tailwind print utilities hide sidebar/buttons; the layout switches to a single-column document.
- Mixed-load print stacks N invoices + N freight slips with manual page-breaks.

---

## Edge cases the agency should test on every change

1. **Empty Pre-Entry queue** — does each module render empty state?
2. **Mixed Load with only 1 customer line** — should be blocked at Pre-Entry validation (min 2).
3. **Net weight = 0** — block downstream document creation.
4. **Negative deductions** — should be blocked numerically.
5. **Posting twice** — second click should be idempotent / disabled.
6. **Print on mobile width** — currently optimised for A4 desktop print only; expect issues on small screens.
7. **Master autocomplete with no results** — `+ Create new` should appear and pre-fill the typed name on the create modal.
