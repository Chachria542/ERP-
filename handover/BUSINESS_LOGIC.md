# Business Logic Reference

This document captures the **domain rules, calculations, validations, and state machines** as currently implemented in the GrainTrade ERP. The agency should treat this as the canonical functional spec for the existing build.

> Glossary: **Qtl** = quintal (100 kg). **Bag** = a sack of grain; weight per bag varies by item/quality and is captured at Pre-Entry. **TCS** = Tax Collected at Source (Indian income-tax provision).

---

## 1. Master entities

| Entity | Key fields | Notes |
|--------|-----------|-------|
| Customer | name, GSTIN, address, city, pincode, contact | Used in Sales |
| Supplier | name, GSTIN, address, city, pincode, contact | Used in Bill Purchase |
| Farmer | name, village, contact, bank details | Used in Farmer Payment |
| Broker | name, commission % | Optional on any deal |
| Transporter | name, contact, vehicle list | Optional |
| Item | name, HSN, default tax %, default unit (Qtl/Bag) | Catalog of grains |
| Company | own GSTIN, address, signatory, bank details | Used in print headers |

All masters support **autocomplete with create-on-the-fly** in the transactional forms.

---

## 2. Pre-Entry rules (universal entry point)

### 2.1 Entry types and downstream routing
| Entry Type | Downstream Module | Generates |
|-----------|-------------------|-----------|
| Purchase | Bill Purchase | Supplier bill |
| Sale (Single Load) | Sales Invoice | 1 invoice |
| Sale (Mixed Load) | Sales Invoice | N invoices |
| Farmer Purchase | Farmer Payment | Payment voucher |
| Custody | Custody | Stock movement only |

### 2.2 Required fields (common)
- Vehicle number (free text, normalised uppercase)
- Entry type (radio/select)
- Item (from master)
- Quality grade (free text or select; **inherited downstream**)
- Expected bags (numeric, > 0)
- Rate per Qtl (numeric, ≥ 0; required for Purchase / Bill Purchase / Sale)
- Party (Customer/Supplier/Farmer per entry type)

### 2.3 Optional
- Transporter, Broker, Driver name/contact, Remarks

### 2.4 Mixed Load specifics
- A single Pre-Entry row can carry **multiple customer line-items**.
- Each line: customer, bags, item rate, optional remarks.
- The Pre-Entry record stores: `is_mixed_load=true`, `total_invoices=N`, `invoice_numbers=[]` (filled later when invoices are generated).
- Validation: at least 2 customer lines, each with bags > 0 and rate ≥ 0.

### 2.5 State after Pre-Entry
Pre-Entry creates a **queue item** in status `pending_weighbridge`. It will appear in:
- Weighbridge "Awaiting" queue
- Module-specific queue with status `weigh-pending`

---

## 3. Weighbridge rules

### 3.1 Two-step flow
1. **Gross In** — vehicle enters loaded; capture gross weight + photo.
2. **Tare Out** — vehicle leaves empty; capture tare weight + photo.

> Photo capture is **MOCKED** (local placeholder). Replace with S3 in production.

### 3.2 Deductions (configurable per entry)
- Bardana (sack weight) — usually `bags × per_bag_weight`
- Moisture deduction
- Dust / foreign matter
- Other (free text + numeric)

### 3.3 Net weight calculation
```
gross_weight  - tare_weight = load_weight (kg)
load_weight   - sum(deductions) = net_weight (kg)
net_weight_qtl = net_weight / 100
```

### 3.4 Mixed Load weight allocation
- The truck is weighed once.
- Net weight is **auto-allocated across customer lines pro-rata to bag count** (current implementation). The agency may need to expose manual override if business requires.
- Total expected weight is auto-calculated on the form for sanity.

### 3.5 Status transitions
`pending_weighbridge` → `weighed` → ready for downstream module.

---

## 4. Bill Purchase rules

### 4.1 Inputs (mostly inherited)
- Supplier, item, quality, bags, net qtl, rate per qtl (inherited from Pre-Entry; editable until post)
- Tax % (from item master, editable)
- TCS slab (if applicable)
- Freight, hamali, other charges (additive)

### 4.2 Calculations
```
basic_amount   = net_qtl × rate_per_qtl
taxable_value  = basic_amount + freight + hamali + other_charges
tax_amount     = taxable_value × tax_%
tcs_amount     = (taxable_value + tax_amount) × tcs_% (if applicable)
grand_total    = taxable_value + tax_amount + tcs_amount
```

### 4.3 State machine
`Draft` → `Posted`. Once posted, document number is locked. (See KNOWN_ISSUES — no formal audit log yet.)

### 4.4 Queue filters
`All`, `Draft`, `Posted`. (`Weigh Pending` was removed because pre-weighbridge entries don't reach this module.)

---

## 5. Sales Invoice rules

### 5.1 Single Load
Mirror of Bill Purchase but on the customer side:
```
basic_amount   = net_qtl × rate_per_qtl
taxable_value  = basic_amount + freight + hamali + packing + other_charges
tax_amount     = taxable_value × tax_%        (CGST+SGST or IGST per state logic)
tcs_amount     = (taxable_value + tax_amount) × tcs_%
grand_total    = taxable_value + tax_amount + tcs_amount
```

### 5.2 Mixed Load — bulk invoice generation
For each customer line in the Pre-Entry:
1. Allocate `net_qtl_i` (pro-rata to bags) and use line-specific `rate_i`.
2. Run the **same Single-Load formula** per line to produce that customer's invoice.
3. All invoices share the **same vehicle, weighbridge entry, and date**, but each gets its own invoice number.
4. The pre-entry record's `invoice_numbers[]` is updated with all generated numbers.
5. A **freight slip per invoice** is also generated.

### 5.3 Print
- Single Load: 1 invoice + 1 freight slip.
- Mixed Load: opens a print preview with N invoices + N freight slips, paginated for browser print.
- Print uses Tailwind's `print:` utilities; sidebar/buttons hidden via `print:hidden`.

### 5.4 Invoice summary card
Shows only: customer name, sub-total, taxes, TCS, grand total. (Simplified per client request.)

### 5.5 Queue filters
`All`, `Draft`, `Posted`. (Filter logic was fixed so "All" returns everything correctly.)

---

## 6. Farmer Payment rules

### 6.1 Voucher fields
- Farmer (from master)
- Vehicle reference (from weighbridge)
- Net qtl, rate per qtl
- Deductions (cash/expense advance)
- Mode (Cash / Bank / UPI), reference number
- Date

### 6.2 Calculation
```
gross_payable = net_qtl × rate_per_qtl
net_payable   = gross_payable - deductions
```

### 6.3 Print view
**Not implemented yet** — agency to build.

---

## 7. Custody / Pledge rules

- Stock-only flow; no money is exchanged.
- Captures: party, item, quality, bags, net qtl, in/out type, reference doc.
- Used to track goods Sudarshan Trading holds on behalf of others (e.g., warehouse receipts).

---

## 8. Validation rules (frontend, summary)

| Field | Rule |
|-------|------|
| Vehicle number | Required, uppercase, free text |
| Bags | Integer ≥ 1 |
| Net qtl | Number > 0; auto-derived from weighbridge |
| Rate per Qtl | Number ≥ 0 |
| GSTIN (if entered) | Pattern check (state code + PAN + entity + Z + check) |
| Pincode | 6 digits when entered |
| Contact | 10 digits when entered |
| Mixed Load | Minimum 2 customer lines |

Forms surface inline errors and disable submit until valid.

---

## 9. State machine summary

```
Pre-Entry (created)
   │
   ▼
pending_weighbridge ──► weighed ──► (draft) ──► posted ──► [printed]
                                       │
                                       └──► editable
posted: locked (no audit log yet)
```

---

## 10. Numbering & sequences

- **Invoice numbers, Bill numbers, Voucher numbers** are server-generated, monotonically increasing per financial year.
- Format and prefix are typically client-configurable in `Company Settings` (HSN/series). Confirm with client before changing.
- Mixed-load invoices consume **N consecutive numbers** in one bulk action.

---

## 11. Roles & permissions (current)

Single role: `admin`. All modules accessible. Multi-role / RBAC is **not yet implemented**.

---

## 12. Known business-logic gaps (call out to client)

- No formal **audit log** on edits to posted docs.
- No **financial-year close** / locking mechanism.
- TCS slab thresholds are coded but not configurable per FY in UI.
- No **credit-limit check** for customers at sale time.
- No **stock-availability check** at sale time (assumes weighed truck = available stock).

These are behavioural decisions; confirm with the client before implementing.
