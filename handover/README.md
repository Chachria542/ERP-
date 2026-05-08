# GrainTrade ERP — Agency Handover Pack

Welcome. This folder contains the **conceptual, business-logic, and frontend handover** for the GrainTrade ERP built for **Sudarshan Trading**.

The agency owns the implementation going forward (backend, infra, deployment). These docs explain *what the product does, why, and how the existing UI is organised* — not how to run servers.

## Read in this order

1. **[HANDOVER.md](./HANDOVER.md)** — Big picture, modules, scope split, what's done vs pending.
2. **[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)** — Every domain rule, calculation, validation, state machine.
3. **[MODULE_FLOWS.md](./MODULE_FLOWS.md)** — Click-through user journeys per module. Read with the live preview open.
4. **[FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md)** — React structure, routing, design system, conventions, recommended first PRs.

## Live preview

- URL: shared separately by the client.
- Login: `admin / admin123`.

## Domain quick-glossary

| Term | Meaning |
|------|---------|
| Qtl | Quintal = 100 kg |
| Bag | Sack of grain (weight per bag depends on item & quality) |
| Pre-Entry | The single, universal entry point for any vehicle entering the yard |
| Weighbridge | Two-step weighing (gross-in, tare-out) with deductions |
| Mixed Load | One truck → multiple customer invoices in a single trip |
| Draft / Posted | Editable vs locked state for bills/invoices |
| TCS | Tax Collected at Source (Indian income-tax provision) |
| Custody / Pledge | Goods we hold for others — no money movement |

## Open questions for the client (the agency should confirm)

- Audit-log requirements on edits to posted documents
- Financial-year close / locking policy
- TCS slabs configurability per FY
- Customer credit-limit checks at sale time
- Stock-availability checks at sale time
- RBAC matrix (current build is single admin role)
