# Frontend Guide

A practical map of the existing React frontend so the agency can extend it without breaking conventions.

---

## 1. Stack

- **React 18** (CRA-style; entry `src/index.js` → `App.js`)
- **React Router v6** (single `BrowserRouter`, all routes in `App.js`)
- **Shadcn/UI** components living in `src/components/ui/` (Radix primitives + Tailwind)
- **Tailwind CSS** for all styling (utility classes; print variants used heavily)
- **Axios** for HTTP, talking to `${REACT_APP_BACKEND_URL}/api`
- **localStorage** for the simple session (`user` object). No refresh tokens yet.

> Don't introduce another router, design system, or HTTP client without aligning with the client first.

---

## 2. Folder layout (frontend)

```
/app/frontend/
├── public/                      # CRA public dir
├── src/
│   ├── App.js                   # Routes + auth gate
│   ├── App.css / index.css      # Tailwind entrypoints + a few overrides
│   ├── components/
│   │   ├── Layout.js            # Sidebar shell + auth-aware nav
│   │   ├── BrokerAutocomplete.js
│   │   ├── CustomerAutocomplete.js
│   │   ├── SupplierAutocomplete.js
│   │   ├── TransporterAutocomplete.js
│   │   └── ui/                  # Shadcn components — DO NOT rewrite, only extend
│   └── pages/
│       ├── LoginPage.js
│       ├── Dashboard.js
│       ├── PreEntryPage.js                ★ heavy logic (universal entry)
│       ├── WeighbridgeEntryPage.js        ★ heavy logic
│       ├── SalesInvoicePage.js            ★ heavy logic (Mixed Load redesign lives here)
│       ├── BillPurchasePage.js
│       ├── FarmerPaymentPage.js
│       ├── CustodyPage.js
│       ├── MasterDataPage.js
│       ├── CompanySettingsPage.js
│       ├── ReportsPage.js
│       ├── LedgerPage.js
│       ├── ProductionPage.js
│       ├── SalesPage.js                   ↳ legacy
│       ├── SalesPreEntryPage.js           ↳ legacy / alternate
│       ├── *Page_old.js                   ↳ retained backups; safe to delete after agency review
│       └── WeighbridgeEntryPage.js.backup ↳ retained backup
├── package.json
└── .env                         # REACT_APP_BACKEND_URL only
```

★ = the three pages where most domain logic lives — review these first.

---

## 3. Routing & auth gate

All routes are declared inline in `App.js` and wrapped with a simple guard:

```js
<Route path="/sales-invoice"
       element={user ? <SalesInvoicePage user={user} onLogout={handleLogout} />
                     : <Navigate to="/login" />} />
```

- `user` is loaded from `localStorage` on mount.
- `handleLogin` stores it; `handleLogout` clears it.
- There is **no token refresh** and no Axios interceptor yet — the agency should add both when implementing real auth.

---

## 4. Layout / shell

`components/Layout.js` renders the sidebar + main content area. Pages typically wrap their JSX in `<Layout user={user} onLogout={onLogout}>…</Layout>`.

- Sidebar uses an inline `navigation` array — **add new modules here** to expose them in the sidebar.
- Active route is detected via `useLocation()`.
- The shell uses a warm cream/olive palette via inline `style={{ background: 'linear-gradient(...)' }}`. To rethemе, refactor these to CSS variables in `index.css`.
- `print:hidden` on the sidebar ensures it disappears for invoice printing.

---

## 5. Design system & conventions

### 5.1 Components
- **Always** use Shadcn primitives from `components/ui/` (Button, Input, Select, Dialog, Card, Table, Tabs, Sonner toast, etc.).
- Path alias: `@/components/ui/<name>` (configured via CRA + jsconfig).
- For toasts: import `toast` from `sonner` (there's a `<Toaster />` mounted at the app root).

### 5.2 Tailwind usage
- Utility-first; no CSS-in-JS.
- Print variants (`print:hidden`, `print:block`, `print:p-0`) are used to switch to printable layouts.
- Spacing: pages typically wrap content in `<div className="p-8 space-y-6">`.

### 5.3 Forms
- Controlled components with local `useState` per page (no Formik / RHF currently).
- Numeric inputs use `type="number"` and parse to numbers on change.
- Validation is inline (string checks, regex for GSTIN/pincode/contact). Submit button is disabled when invalid.

### 5.4 Tables
- Most queues use a basic `<Table>` (Shadcn) with status badges.
- **No pagination** yet — full list is fetched on mount. Plan to add server-side pagination when extending.

### 5.5 data-testid convention
Every interactive element should carry `data-testid` (kebab-case, function-named):
```jsx
<Button data-testid="post-invoice-button">Post Invoice</Button>
<Input  data-testid="invoice-rate-input" ... />
```
This is used by automated testing. Maintain it on any new code.

---

## 6. State management

- No Redux / Zustand. Each page is self-contained with `useState` + `useEffect`.
- Cross-page communication happens **via the backend**: e.g. SalesInvoicePage refetches the queue on mount.
- The only global state is `user` in `App.js` + `localStorage`.

If module count or shared state grows, consider introducing **React Query** (server cache) before pulling in a global state library — most needs here are server-cache, not client-state.

---

## 7. API access pattern

```js
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const res = await axios.get(`${API}/sales/queue`);
```

- Always go through `${API}` (do **not** hardcode hosts).
- All endpoints are prefixed with `/api` — required by Kubernetes ingress routing.
- Errors: components show `toast.error(err?.response?.data?.detail || 'Something went wrong')`.

When implementing real auth, add an Axios instance with a request interceptor that injects `Authorization: Bearer <token>`.

---

## 8. Reusable patterns to keep

### 8.1 Autocomplete components
`CustomerAutocomplete`, `SupplierAutocomplete`, `BrokerAutocomplete`, `TransporterAutocomplete`:
- Accept `value` + `onChange` props.
- Internally fetch the master list, debounce input, support **inline create** of a new master record.
- Mimic this pattern for any future master (e.g., Items autocomplete).

### 8.2 Field inheritance
When adding a new downstream module that consumes a Pre-Entry, **prefill from the pre-entry payload** rather than re-entering. Existing modules show the right field-set to copy.

### 8.3 Print template structure
Print views are normal React components rendered inside the page; the page calls `window.print()` and CSS `print:` utilities reshape the DOM. For new print views (Bill / Farmer voucher), follow `SalesInvoicePage`'s template block.

---

## 9. Things to clean up (safe refactors)

- Delete `*Page_old.js` and `*.backup` files after the agency confirms they're not referenced.
- Lift Tailwind colour gradients into CSS variables for theming.
- Extract repeated Pre-Entry → downstream "inherited fields" block into a shared component.
- Introduce a single `apiClient.js` with the Axios instance + interceptors.
- Add pagination + skeleton states on every queue.

---

## 10. Local dev (for reference only — agency will manage their own)

- Frontend served by supervisor on port `3000`.
- Backend on `0.0.0.0:8001`, ingress maps `/api/*` → backend.
- Hot reload is on by default.
- `.env` keys: `REACT_APP_BACKEND_URL` only — never hardcode URLs.

---

## 11. Recommended first PRs for the agency

1. Add Axios instance + interceptor (foundation for any auth migration).
2. Implement Bill Purchase **print voucher** (mirror Sales Invoice pattern).
3. Implement Farmer Payment **print voucher**.
4. Add server-side **pagination** to the three queue pages.
5. Replace mocked weighbridge photos with real S3 upload + signed URL display.

These are low-risk, high-visibility wins that also build agency familiarity with the codebase.
