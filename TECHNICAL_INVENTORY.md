# GrainTrade ERP - Technical Inventory
*Generated: December 2024*
*Modules: Weighbridge Pre-Entry + Farmer Payment*

---

## Part A — Human-Readable Summary

### 🚀 System Overview

**GrainTrade ERP** is a custom agricultural commodity trading system built for Sudarshan Trading Company. The system handles grain trading, custody, and funding operations with a focus on weighbridge integration and farmer payments.

**Architecture:** React frontend + FastAPI backend + MongoDB database

---

### 📄 Modules & Routes

#### **Frontend Routes (/app/frontend/src/pages/)**

| Path | Component | Purpose | Key UI Actions |
|------|-----------|---------|----------------|
| `/login` | LoginPage.js | User authentication | Username/password login, registration link |
| `/` | Dashboard.js | Main dashboard | Stats overview, navigation hub |
| `/pre-entry` | PreEntryPage.js | Office-side weighbridge pre-entry | Create slip, QR generation, OTP verification |
| `/weighbridge` | WeighbridgeEntryPage.js | Operator-side weighbridge entry | Weight capture, photo upload, slip completion |
| `/farmer-payment` | FarmerPaymentPage.js | Farmer payment processing | Queue management, payment creation, voucher generation |
| `/custody` | CustodyPage.js | Custody & pledge management | Lot creation, pledge requests, margin calls |
| `/purchases` | PurchasePage.js | Bill purchase module | Purchase order creation and management |
| `/sales` | SalesPage.js | Sales module | Invoice generation, GST calculation |
| `/production` | ProductionPage.js | Production tracking | Batch processing, yield calculation |
| `/ledger` | LedgerPage.js | Accounting ledger | Journal entries, ledger management |
| `/master-data` | MasterDataPage.js | Master data management | Items, parties, configuration |
| `/reports` | ReportsPage.js | Reports & analytics | Financial reports, analytics |

#### **Backend API Routes (/api/)**

**Authentication:**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

**Universal Weighbridge System:**
- `POST /api/pre-entry` - Create weighbridge pre-entry
- `GET /api/pre-entries` - List pre-entries (filterable)
- `POST /api/weighbridge-entry` - Create weighbridge entry with weights
- `GET /api/weighbridge-entries` - List weighbridge entries
- `GET /api/weighbridge-entry/{slip_id}` - Get specific entry for auto-fill
- `GET /api/farmers` - List farmers
- `GET /api/farmer/{mobile}` - Get farmer by mobile

**OTP Verification:**
- `POST /api/otp/send` - Send OTP to mobile
- `POST /api/otp/verify` - Verify OTP
- `POST /api/otp/resend` - Resend OTP with cooldown
- `GET /api/otp/check-verification/{mobile}` - Check verification status

**Farmer Payment:**
- `GET /api/farmer-payment/queue` - Get payment queue (filterable/searchable)
- `POST /api/farmer-payment` - Create farmer payment
- `GET /api/farmer-payments` - List all payments
- `GET /api/book-number-next` - Generate next book number
- `PUT /api/weighbridge-entry/{slip_id}/payment-status` - Update payment status

**Master Data:**
- `GET /api/items` - List items
- `POST /api/items` - Create item
- `GET /api/parties` - List parties
- `POST /api/parties` - Create party

---

### 🔄 State & Flows

#### **Core User Flow: Pre-Entry → Weighbridge → Payment**

**1. Pre-Entry Creation (Office Staff)**
```
Office → Pre-Entry Page → Select Transaction Type → Enter Party Details → 
OTP Verification (for new farmers) → Enter Item & Rate → Generate Slip ID → 
QR Code Generated → Slip Ready for Weighbridge
```

**2. Weighbridge Entry (Operator)**
```
Operator → Weighbridge Page → Scan QR/Enter Slip ID → View Pre-Entry Details → 
Enter Vehicle Info → Capture Gross Weight → Capture Tare Weight → 
Upload Photos → Calculate Net Weight → Complete Entry
```

**3. Farmer Payment (Payment Processing)**
```
Payment Desk → Payment Queue → Select Pending Slip → Photo Approval Modal → 
Auto-fill Farmer Details → Auto-populate Line Items → Verify/Edit Rates → 
H+T Auto-calculation → Generate Book Number → Process Payment → 
Create Purchase & Payment Vouchers → Print Receipt
```

#### **OTP Verification Flow (New Farmers)**
```
Mobile Number Entry → "Verify Mobile" Button → OTP Sent (Mock SMS to Console) → 
Enter 4-digit OTP → 60-second Countdown Timer → OTP Verification → 
"Verified" Badge → Allow Form Submission
```

#### **Photo Approval Checkpoint**
- **Gross Weight Photo:** Timestamp, vehicle on scale with visible weight display
- **Tare Weight Photo:** Empty vehicle on scale with visible weight display
- **Approval Process:** Photos displayed in modal, approve/reject buttons
- **Status Tracking:** Photo upload status (pending/success/failed)

#### **H+T Auto-calculation Logic**
```javascript
// Vehicle-specific rates per quintal
Truck: ₹4.75/qtl
Tractor: ₹0.00/qtl (no H+T charges)
Hammali: ₹5.75/qtl

// Calculation
H+T Amount = Vehicle Rate × Act Quintals
Line Total = Item Amount - H+T Amount
```

---

### ⚖️ Business Rules

#### **Field Validations**
- **Mobile Number:** 10 digits, unique identifier for farmers
- **OTP:** 4 digits, 2-minute expiry, 5 max attempts
- **Weight Validation:** Gross > Tare weight, positive values only
- **Slip ID Format:** WB-YY-###### (WB-25-000001)
- **Book Number Format:** SAN-YY-###### (SAN-25-000001)
- **Rate Validation:** Positive values, per quintal basis

#### **Status Transitions**
**Pre-Entry Status Flow:**
```
pending → weighed → completed
pending → cancelled
```

**Weighbridge Entry Status:**
```
completed → (final status)
cancelled → (alternative final status)  
```

**Payment Status Flow:**
```
pending_payment → payment_completed → (vouchers generated)
pending_payment → payment_cancelled
```

#### **Rounding Rules**
- **Weights:** 2 decimal places
- **Rates:** 2 decimal places 
- **Amounts:** 2 decimal places
- **Quintals:** 2 decimal places (kg ÷ 100)
- **H+T Calculation:** 2 decimal places

#### **Required Fields Policy**
**Pre-Entry:** Transaction type, party name, mobile (if farmer), item, expected bags
**Weighbridge:** Slip ID, vehicle number, gross weight, tare weight, photos
**Payment:** Farmer details, line items, payment type, book number

#### **Partial Settlement Policy**
- **Not Implemented:** Currently full settlement only
- **Future Enhancement:** Partial quantity and amount settlements planned

---

### 📝 Posting Logic

#### **Purchase Voucher Generation**
```
Trigger: Farmer payment creation
Sequence:
1. Generate unique voucher number
2. Create purchase voucher record
3. Link to farmer payment (farmer_payment_id)
4. Set voucher type = "purchase" 
5. Record total amount and farmer details
6. Create ledger entries (Dr: Purchase A/c, Cr: Farmer A/c)
```

#### **Payment Voucher Generation**  
```
Trigger: Farmer payment creation
Sequence:
1. Generate unique voucher number
2. Create payment voucher record  
3. Link to farmer payment (farmer_payment_id)
4. Set voucher type = "payment"
5. Record payment mode (cash/bank), amounts
6. Create ledger entries (Dr: Farmer A/c, Cr: Cash/Bank A/c)
```

#### **Ledger Entries Touched**
- **Purchase Account** (Dr) - Item purchase value
- **Farmer Account** (Cr/Dr) - Farmer liability/payment
- **Cash Account** (Cr) - Cash payments
- **Bank Account** (Cr) - Bank payments
- **H+T Account** (Dr) - Handling charges

#### **Idempotency & Locking**
- **Current State:** No concurrent weighbridge locking implemented
- **Farmer Payment:** Single processing per slip ID
- **Voucher Generation:** Atomic operation per payment
- **Book Number:** Sequential generation with collision prevention

---

### 🖨️ Printing

#### **Available Templates**
- **Farmer Payment Voucher:** Receipt format with farmer details, line items, totals
- **Purchase Voucher:** Accounting voucher with line-by-line breakdown
- **Payment Voucher:** Payment receipt with mode details

#### **Fields Shown**
- **Header:** Book number, date, location, contract type
- **Farmer Info:** Name, mobile, city, Aadhaar, token number
- **Line Items:** Item name, bags, quintals, rate, H+T charges, line total
- **Totals:** Gross amount, total H+T, additional charges, net payable
- **Payment:** Mode (cash/bank), account details, amounts

#### **Bilingual Labels**
- **Current:** English labels only
- **Pending:** Hindi translations for field labels
- **Format:** English (Hindi) dual labeling planned

#### **Amount in Words**
- **Status:** Not implemented
- **Format:** ₹One Lakh Twenty-Three Thousand Four Hundred Fifty-Six Only
- **Languages:** English and Hindi number words planned

---

### 🔒 Security

#### **Roles & Permissions**
```javascript
// Current roles defined
admin: Full system access
manager: Module access, reporting
operator: Weighbridge operations only  
accountant: Financial modules only
```

#### **Field Locking Rules**
- **Weighbridge Entry:** Cannot modify after completion
- **Payment Processing:** Cannot modify after voucher generation  
- **Book Numbers:** Auto-generated, non-editable
- **Slip IDs:** Auto-generated, non-editable

#### **Audit Trail Events**
- **User Login/Logout:** Authentication events
- **Payment Creation:** Full payment record with timestamp
- **Voucher Generation:** Voucher creation with user reference
- **Status Changes:** Pre-entry and payment status modifications
- **OTP Verification:** Mobile verification events

#### **Current Limitations**
- **No Role-Based UI:** All users see all modules
- **No Field-Level Permissions:** Role restrictions not implemented in UI
- **No Session Management:** Basic localStorage authentication only

---

### 💾 Storage

#### **Photo Storage**
- **Current:** Mock S3 URLs for development
- **Format:** `https://mock-s3.example.com/photos/WB-25-000001-gross.jpg`
- **Types:** Gross weight, tare weight photos per weighbridge entry
- **Status:** Mock implementation, real S3 integration pending

#### **URL Format**
```
Mock: https://mock-s3.example.com/photos/{slip_id}-{type}.jpg
Real (Planned): https://{bucket}.s3.{region}.amazonaws.com/photos/{slip_id}/{type}-{timestamp}.jpg
```

#### **Pre-signed Link TTLs**
- **Not Implemented:** Direct URLs currently used
- **Planned:** 1-hour TTL for photo access
- **Security:** Signed URLs for photo access control

#### **Size Limits & Thumbnails**
- **Size Limits:** Not implemented (5MB planned)
- **Thumbnails:** Not generated (200x200px planned)  
- **Compression:** Not implemented (80% JPEG planned)

---

### 🔢 Sequences

#### **Book Number Rule**
```
Format: SAN-YY-######
SAN: Location code (Sanawad)
YY: Financial year (25 for FY 2024-25)
######: 6-digit sequence (000001, 000002...)
Reset: April 1st each year
```

#### **Slip Number Pattern** 
```
Format: WB-YY-######  
WB: Weighbridge prefix
YY: Financial year (25 for FY 2024-25)
######: 6-digit sequence (000001, 000002...)
Reset: April 1st each year
```

#### **Financial Year Rollover**
- **Date:** April 1st (Indian financial year)
- **Sequence Reset:** Both book numbers and slip numbers reset to 000001
- **Year Calculation:** Automatic based on current date (Apr-Mar cycle)

#### **Collision Prevention**
- **Method:** MongoDB atomic operations with retry logic
- **Sequence Generation:** Last number lookup + increment in single transaction
- **Concurrency:** Handled by database-level constraints

---

### 🔌 Integrations

#### **Current Integrations**
- **MongoDB:** Database operations
- **Mock SMS Gateway:** OTP delivery (console logging)
- **Mock S3:** Photo storage URLs
- **Mock AI (Gemini 2.5 Pro):** Margin call recommendations for custody module

#### **API Endpoints Called**
- **Internal Only:** No external API integrations currently
- **Database:** MongoDB CRUD operations
- **File Storage:** Mock S3 URLs generated internally

#### **Retry Queues**
- **Not Implemented:** No retry mechanisms for failed operations
- **Planned:** SMS retry queue, photo upload retry, external API resilience

#### **Failure Handling**
- **Database Failures:** Basic error messages returned
- **Network Issues:** Frontend axios timeout (30 seconds)
- **No Circuit Breakers:** Planned for external integrations

---

### 🚧 Known TODOs & Assumptions

#### **Mocked/Stubbed Components**
```javascript
// Mock SMS Gateway
console.log(`📱 [MOCK SMS] Sending OTP to ${mobile}: ${otp}`)

// Mock S3 URLs  
photo_gross_url: `https://mock-s3.example.com/photos/${slip_id}-gross.jpg`

// Mock Weighbridge Hardware Integration
// Real integration with weighbridge scales pending
// Currently manual weight entry

// Mock Printer Integration
// Real thermal printer integration pending
// Currently browser print functionality
```

#### **Hardware API Assumptions**
- **Weighbridge Scale:** Manual weight entry (hardware API pending)
- **Thermal Printer:** Browser print (direct printer API pending)  
- **Camera/Photo:** File upload (direct camera API pending)
- **QR Scanner:** Manual entry (scanner hardware API pending)

#### **Business Logic Assumptions**
- **Single Weighbridge:** No concurrent operator support
- **Full Settlement Only:** No partial payment logic
- **Single Currency:** INR only, no multi-currency
- **Fixed H+T Rates:** Vehicle rates hardcoded, no dynamic pricing

#### **Technical Debt**
- **Real S3 Integration:** Replace mock URLs with actual S3 operations
- **Role-Based Permissions:** Implement UI access control
- **Session Management:** Replace localStorage with proper JWT/session handling
- **Concurrent Weighbridge:** Add locking mechanisms for multiple operators
- **Error Handling:** Comprehensive error boundaries and user-friendly messages
- **Performance:** Add caching, pagination for large datasets
- **Testing:** Unit tests, integration tests, end-to-end testing suite

#### **Integration Pending**
- **SMS Gateway:** Real SMS service (Twilio/AWS SNS)
- **Email Service:** SMTP for notifications and reports  
- **Payment Gateway:** UPI/NEFT integration for digital payments
- **ERP Integration:** SAP/Tally integration for accounting sync
- **Hardware Integration:** Weighbridge scales, thermal printers, barcode scanners

---

## Part B — Machine-Readable Export

### Database Schema (MongoDB Collections)

#### **pre_entries**
```json
{
  "id": "uuid",
  "slip_id": "WB-25-000001", 
  "qr_code": "SLIP:WB-25-000001|TYPE:farmer_purchase",
  "transaction_type": "farmer_purchase|bill_purchase|sale|custody_deposit|custody_withdrawal|internal_transfer",
  "from_location": "string",
  "to_location": "string?",
  "party_type": "farmer|trader|buyer|own_stock", 
  "party_id": "uuid?",
  "party_name": "string",
  "party_mobile": "string?",
  "party_gstin": "string?",
  "item_id": "uuid",
  "item_name": "string",
  "quality": "string?",
  "expected_bags": "integer?",
  "rate_per_qtl": "float?",
  "status": "pending|weighed|completed|cancelled",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime?"
}
```

#### **weighbridge_entries**  
```json
{
  "id": "uuid",
  "slip_id": "WB-25-000001",
  "pre_entry_id": "uuid",
  "vehicle_number": "string", 
  "vehicle_type": "string",
  "driver_name": "string?",
  "gross_weight": "float",
  "tare_weight": "float", 
  "net_weight": "float",
  "bags": "integer",
  "rem_kg": "integer",
  "act_qtl": "float",
  "photo_gross_url": "string",
  "photo_tare_url": "string",
  "weighbridge_operator": "string",
  "payment_status": "pending_payment|payment_completed|payment_cancelled",
  "status": "completed|cancelled",
  "created_at": "datetime"
}
```

#### **farmers**
```json
{
  "id": "uuid",
  "mobile": "string",
  "name": "string", 
  "city": "string?",
  "aadhaar": "string?",
  "mobile_verified": "boolean",
  "mobile_verified_at": "datetime?",
  "otp_verified_count": "integer",
  "created_at": "datetime",
  "updated_at": "datetime?"
}
```

#### **otp_verifications**
```json
{
  "id": "uuid",
  "mobile": "string",
  "otp": "string",
  "created_at": "datetime",
  "expires_at": "datetime", 
  "verified": "boolean",
  "attempts": "integer",
  "max_attempts": "integer",
  "last_resend_at": "datetime?"
}
```

#### **farmer_payments**
```json
{
  "id": "uuid",
  "location": "string",
  "contract_type": "string",
  "mandi_godown": "string", 
  "book_no": "SAN-25-000001",
  "bilty_no": "string?",
  "date": "string",
  "tulai_no": "string?",
  "agr_no": "string?", 
  "id_no": "string?",
  "gate_entry_no": "string?",
  "aadhaar": "string?",
  "token_no": "string?",
  "farmer_name": "string",
  "mobile": "string",
  "city": "string?",
  "lines": [
    {
      "item_id": "uuid",
      "item_name": "string",
      "pack_kg": 100,
      "bags": "integer", 
      "rem_kg": "integer",
      "act_kg": "float",
      "act_qtl": "float",
      "rate_per_qtl": "float",
      "item_amount": "float",
      "vehicle_type": "string",
      "h_plus_t": "float", 
      "line_total": "float",
      "sort_order": "integer"
    }
  ],
  "pay_type": "string",
  "cash_bank_ac_id": "string?",
  "account_no": "string?",
  "cash_amt": "float", 
  "bank_amt": "float",
  "additional_hamli": "float",
  "bank_charges": "float",
  "total_amount": "float",
  "purchase_voucher_id": "uuid?",
  "payment_voucher_id": "uuid?",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime?"
}
```

### API Endpoints Reference

#### **Authentication**
```yaml
POST /api/auth/login:
  body: {username: string, password: string}
  response: {message: string, user: UserObject}
  
POST /api/auth/register:
  body: {username: string, password: string, name: string, role: string}
  response: {message: string, user_id: string}
```

#### **Universal Weighbridge**
```yaml
POST /api/pre-entry:
  body: PreEntryCreateObject
  response: PreEntryObject
  
GET /api/pre-entries:
  query: {status?: string, transaction_type?: string, limit?: number}
  response: PreEntryObject[]
  
POST /api/weighbridge-entry:
  body: WeighbridgeEntryCreateObject  
  response: WeighbridgeEntryObject
  
GET /api/weighbridge-entry/{slip_id}:
  response: CombinedWeighbridgeDataObject
```

#### **OTP Verification**
```yaml
POST /api/otp/send:
  body: {mobile: string}
  response: {message: string, expires_in: number, requires_otp: boolean}
  
POST /api/otp/verify:
  body: {mobile: string, otp: string}
  response: {message: string, verified: boolean}
  
GET /api/otp/check-verification/{mobile}:
  response: {farmer_exists: boolean, verified: boolean, requires_otp: boolean}
```

#### **Farmer Payment**  
```yaml
GET /api/farmer-payment/queue:
  query: {search?: string, date_filter?: string, sort_by?: string, sort_order?: string}
  response: PaymentQueueItemObject[]
  
POST /api/farmer-payment:
  body: FarmerPaymentCreateObject
  response: {message: string, payment_id: string, vouchers: VoucherObject[]}
  
GET /api/book-number-next:
  response: {book_number: string}
```

### Configuration & Environment

#### **Environment Variables**
```env
# Backend (.env)
MONGO_URL=mongodb://localhost:27017
DB_NAME=sudarshan_erp
EMERGENT_LLM_KEY=xxx
CORS_ORIGINS=http://localhost:3000

# Frontend (.env) 
REACT_APP_BACKEND_URL=https://trading-platform-95.preview.emergentagent.com
```

#### **Technology Stack**
```yaml
Backend:
  - Framework: FastAPI (Python)
  - Database: MongoDB with Motor (async)
  - Authentication: Basic username/password
  - Validation: Pydantic models
  - CORS: Enabled for frontend domain

Frontend:
  - Framework: React 18
  - Routing: React Router v6
  - UI Components: Shadcn/UI + Tailwind CSS
  - HTTP Client: Axios
  - State Management: React useState/useEffect
  - Build: Vite/Create React App

Infrastructure:
  - Deployment: Kubernetes containers
  - Frontend: Port 3000 (hot reload)  
  - Backend: Port 8001 (supervisor)
  - Database: MongoDB local instance
  - File Storage: Mock S3 URLs
```

#### **Business Constants**
```javascript
// H+T Rates (per quintal)
const H_T_RATES = {
  "Truck": 4.75,
  "Tractor": 0.00, 
  "Hammali": 5.75
};

// Transaction Types
const TRANSACTION_TYPES = [
  "farmer_purchase", "bill_purchase", "sale", 
  "custody_deposit", "custody_withdrawal", "internal_transfer"
];

// Party Types  
const PARTY_TYPES = ["farmer", "trader", "buyer", "own_stock"];

// Payment Types
const PAYMENT_TYPES = ["Cash", "Cheque", "RTGS", "aadat", "Farmer", "NEFT"];

// Contract Types
const CONTRACT_TYPES = ["Anubandh", "Sauda"];

// Locations
const LOCATIONS = ["Sanawad Mandi", "Sanawad Godown"];
```

---

*This technical inventory provides a complete overview of the current GrainTrade ERP system focusing on the Weighbridge Pre-Entry and Farmer Payment modules. Use this document for team briefings, module extensions, and technical onboarding.*