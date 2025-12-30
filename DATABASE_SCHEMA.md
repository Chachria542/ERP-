# ERP Database Schema Documentation

## Database: MongoDB (test_database)

---

## Collections Overview

1. **users** - User authentication and roles
2. **parties** - Customers, Suppliers, Farmers (unified party master)
3. **brokers** - Broker master data
4. **items** - Item/Product master data
5. **transporters** - Transporter master data
6. **weighbridge_queue** - Universal weighbridge entries
7. **sales_pre_entries** - Sales pre-entries (single & mixed load)
8. **sales_invoices** - Sales invoices
9. **bill_purchase_pre_entries** - Bill purchase pre-entries
10. **bill_purchase_bills** - Bill purchase bills/vouchers
11. **farmer_payments** - Farmer payment vouchers
12. **company_settings** - Company/Organization settings
13. **otp_store** - OTP verification records

---

## Detailed Collection Schemas

### 1. users
```json
{
  "id": "UUID (string)",
  "username": "string (unique)",
  "password": "string (hashed)",
  "role": "string (admin/user)",
  "email": "string (optional)",
  "created_at": "datetime"
}
```

---

### 2. parties (Unified Master)
```json
{
  "id": "UUID (string)",
  "party_type": "string (customer/supplier/farmer)",
  "name": "string (required)",
  "mobile": "string (optional)",
  "email": "string (optional)",
  "gstin": "string (optional, 15 chars)",
  "pan": "string (optional, 10 chars)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "state_code": "string (optional, 2 digits)",
  "pin_code": "string (optional, 6 digits)",
  "village": "string (optional, for farmers)",
  "bank_name": "string (optional)",
  "account_number": "string (optional)",
  "ifsc_code": "string (optional)",
  "branch": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `name` (text search)
- `mobile` (optional unique)
- `gstin` (optional)

---

### 3. brokers
```json
{
  "id": "UUID (string)",
  "name": "string (required)",
  "mobile": "string (optional)",
  "email": "string (optional)",
  "gstin": "string (optional)",
  "pan": "string (optional)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "pin_code": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `name` (text search)

---

### 4. items
```json
{
  "id": "UUID (string)",
  "name": "string (required)",
  "hsn_code": "string (optional)",
  "rate": "float (optional, default rate per quintal)",
  "unit": "string (default: quintal)",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `name` (text search)

---

### 5. transporters
```json
{
  "id": "UUID (string)",
  "name": "string (required)",
  "mobile": "string (optional)",
  "email": "string (optional)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "gstin": "string (optional)",
  "pan": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

---

### 6. weighbridge_queue (Universal Weighbridge)
```json
{
  "id": "UUID (string)",
  "slip_id": "string (WBE-25-XXXXX)",
  "qr_code": "string (base64 encoded QR)",
  "transaction_type": "string (farmer_purchase/bill_purchase/sale/custody_deposit/custody_withdrawal/internal_transfer)",
  "date": "date (ISO format)",
  "party_type": "string (farmer/supplier/customer/own_stock)",
  "party_name": "string",
  "party_mobile": "string (optional)",
  "party_village": "string (optional)",
  "party_gstin": "string (optional)",
  "item_id": "string (UUID)",
  "item_name": "string",
  "quality": "string (optional)",
  "expected_bags": "integer (optional)",
  "rate_per_qtl": "float (optional)",
  "from_location": "string",
  "to_location": "string (optional)",
  "vehicle_number": "string (optional)",
  "first_weight": "float (optional, kg)",
  "first_weight_time": "datetime (optional)",
  "second_weight": "float (optional, kg)",
  "second_weight_time": "datetime (optional)",
  "net_weight": "float (optional, kg)",
  "weighbridge_completed": "boolean",
  "photo_tare": "string (optional, photo path)",
  "photo_gross": "string (optional, photo path)",
  "status": "string (weigh_pending/pending_invoice/completed/cancelled)",
  "created_by": "string (user ID)",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `slip_id` (unique)
- `transaction_type`
- `status`
- `weighbridge_completed`

---

### 7. sales_pre_entries
```json
{
  "id": "UUID (string)",
  "pre_entry_number": "string (SPRE-25-XXXXX)",
  "slip_id": "string (same as pre_entry_number)",
  "qr_code": "string (base64)",
  "date": "date (ISO)",
  "order_number": "string (optional)",
  "is_mixed_load": "boolean (default: false)",
  "line_items": [
    {
      "line_id": "UUID",
      "customer_id": "UUID",
      "customer_name": "string",
      "customer_gstin": "string (optional)",
      "place_of_supply": "string",
      "item_id": "UUID",
      "item_name": "string",
      "marka": "string (optional)",
      "bharti": "integer (pack size in kg)",
      "expected_bags": "integer",
      "expected_weight": "float (kg)",
      "item_rate": "float",
      "invoice_id": "UUID (optional, set after invoice creation)",
      "actual_weight": "float (optional)"
    }
  ],
  "customer_id": "UUID (optional, for single load)",
  "customer_name": "string (optional)",
  "customer_gstin": "string (optional)",
  "place_of_supply": "string (optional)",
  "item_id": "UUID (optional, for single load)",
  "item_name": "string (optional)",
  "quality": "string (optional)",
  "expected_bags": "integer (optional)",
  "rate_per_qtl": "float (optional)",
  "item_rate": "float (optional)",
  "marka": "string (optional)",
  "bharti": "integer (optional)",
  "expected_weight": "float (optional)",
  "has_broker": "boolean",
  "broker_id": "UUID (optional)",
  "broker_name": "string (optional)",
  "brokerage_type": "string (per_quintal/per_bag/percentage)",
  "brokerage_rate": "float (optional)",
  "weighbridge_completed": "boolean",
  "gross_weight": "float (optional, kg)",
  "net_weight": "float (optional, kg)",
  "vehicle_number": "string (optional)",
  "invoice_numbers": ["string array (for mixed loads)"],
  "total_invoices": "integer (optional)",
  "status": "string (pending/invoice_generated)",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `pre_entry_number` (unique)
- `status`
- `is_mixed_load`
- `weighbridge_completed`

---

### 8. sales_invoices
```json
{
  "id": "UUID (string)",
  "invoice_number": "string (SAL-25-XXXXX)",
  "sale_type": "string (normal_sale/sales_return)",
  "invoice_date": "date (ISO)",
  "pre_entry_id": "UUID",
  "pre_entry_number": "string",
  "pre_entry_line_id": "UUID (optional, for mixed loads)",
  "customer_id": "UUID",
  "customer_name": "string",
  "customer_gstin": "string (optional)",
  "customer_address": "string (optional)",
  "customer_city": "string (optional)",
  "customer_state": "string (optional)",
  "customer_pin_code": "string (optional)",
  "customer_pan": "string (optional)",
  "place_of_supply": "string",
  "is_entry": "boolean",
  "broker_id": "UUID (optional)",
  "broker_name": "string (optional)",
  "broker_mobile": "string (optional)",
  "broker_address": "string (optional)",
  "broker_gstin": "string (optional)",
  "brokerage_type": "string",
  "brokerage_rate": "float",
  "broker_commission": "float",
  "line_items": [
    {
      "item_id": "UUID",
      "item_name": "string",
      "marka": "string (optional)",
      "bags": "integer",
      "kgs": "float",
      "bharti": "integer",
      "actual_qtl": "float",
      "rate": "float (rate per quintal)",
      "amount": "float"
    }
  ],
  "cgst_rate": "float",
  "cgst_amount": "float",
  "sgst_rate": "float",
  "sgst_amount": "float",
  "igst_rate": "float (optional)",
  "igst_amount": "float (optional)",
  "freight": "float",
  "loading_charges": "float",
  "other_charges": "float",
  "tcs_applicable": "boolean",
  "tcs_rate": "float (optional)",
  "tcs_amount": "float",
  "subtotal": "float",
  "round_off": "float",
  "grand_total": "float",
  "vehicle_number": "string (optional)",
  "city_from": "string (optional)",
  "city_to": "string (optional)",
  "driver_name": "string (optional)",
  "driver_contact": "string (optional)",
  "freight_slip_number": "string (optional, FRG-25-XXXXX)",
  "remarks": "string (optional)",
  "status": "string (posted/cancelled)",
  "posted_at": "datetime (optional)",
  "posted_by": "string (optional)",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `invoice_number` (unique)
- `pre_entry_id`
- `customer_id`
- `status`
- `invoice_date`

---

### 9. bill_purchase_pre_entries
```json
{
  "id": "UUID (string)",
  "pre_entry_number": "string (BPRE-25-XXXXX)",
  "slip_id": "string",
  "qr_code": "string (base64)",
  "date": "date (ISO)",
  "supplier_id": "UUID",
  "supplier_name": "string",
  "supplier_gstin": "string (optional)",
  "place_of_supply": "string",
  "item_id": "UUID (optional)",
  "item_name": "string (optional)",
  "quality": "string (optional)",
  "expected_bags": "integer (optional)",
  "rate_per_qtl": "float (optional)",
  "item_rate": "float (optional)",
  "has_broker": "boolean",
  "broker_name": "string (optional)",
  "brokerage_type": "string (optional)",
  "brokerage_rate": "float (optional)",
  "eway_bill_no": "string (optional)",
  "expected_quantity_bags": "integer (optional)",
  "expected_quantity_kgs": "float (optional)",
  "expected_quantity_qtls": "float (optional)",
  "weighbridge_completed": "boolean",
  "net_weight": "float (optional, kg)",
  "vehicle_number": "string (optional)",
  "status": "string (weigh_pending/pending/bill_generated/cancelled)",
  "bill_id": "UUID (optional)",
  "remarks": "string (optional)",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `pre_entry_number` (unique)
- `status`
- `supplier_id`

---

### 10. bill_purchase_bills
```json
{
  "id": "UUID (string)",
  "bill_number": "string (BPB-25-XXXXX)",
  "bill_date": "date (ISO)",
  "pre_entry_id": "UUID",
  "pre_entry_number": "string",
  "supplier_id": "UUID",
  "supplier_name": "string",
  "supplier_gstin": "string (optional)",
  "supplier_address": "string (optional)",
  "place_of_supply": "string",
  "line_items": [
    {
      "item_id": "UUID",
      "item_name": "string",
      "quality": "string (optional)",
      "pack_size": "integer (bharti)",
      "bags": "integer",
      "remaining_kg": "float",
      "actual_weight": "float (quintals)",
      "agreed_weight": "float (quintals)",
      "rate_per_qtl": "float",
      "amount": "float",
      "cgst_rate": "float",
      "sgst_rate": "float",
      "igst_rate": "float",
      "cgst_amount": "float",
      "sgst_amount": "float",
      "igst_amount": "float",
      "sort_order": "integer"
    }
  ],
  "has_broker": "boolean",
  "broker_name": "string (optional)",
  "brokerage_type": "string (optional)",
  "brokerage_rate": "float (optional)",
  "total_brokerage": "float",
  "batav_type": "string (flat/percentage)",
  "batav_percentage": "float (optional)",
  "batav_amount": "float",
  "claim_type": "string (flat/per_bag)",
  "claim_rate": "float",
  "total_claim": "float",
  "subtotal": "float",
  "total_cgst": "float",
  "total_sgst": "float",
  "total_igst": "float",
  "round_off": "float",
  "grand_total": "float",
  "vehicle_number": "string (optional)",
  "remarks": "string (optional)",
  "status": "string (draft/posted)",
  "posted_at": "datetime (optional)",
  "posted_by": "string (optional)",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `bill_number` (unique)
- `pre_entry_id`
- `supplier_id`
- `status`

---

### 11. farmer_payments
```json
{
  "id": "UUID (string)",
  "payment_number": "string (FP-25-XXXXX)",
  "payment_date": "date (ISO)",
  "weighbridge_slip_id": "UUID",
  "slip_number": "string",
  "farmer_name": "string",
  "farmer_mobile": "string (optional)",
  "farmer_village": "string (optional)",
  "item_name": "string",
  "quality": "string (optional)",
  "net_weight": "float (kg)",
  "quintals": "float",
  "rate_per_qtl": "float",
  "amount": "float",
  "batav_percentage": "float",
  "batav_amount": "float",
  "net_payable": "float",
  "payment_mode": "string (cash/cheque/bank_transfer/upi)",
  "payment_reference": "string (optional)",
  "bank_name": "string (optional)",
  "account_number": "string (optional)",
  "ifsc_code": "string (optional)",
  "remarks": "string (optional)",
  "payment_status": "string (pending/completed)",
  "status": "string (draft/posted)",
  "posted_at": "datetime (optional)",
  "posted_by": "string (optional)",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

**Indexes:**
- `id` (unique)
- `payment_number` (unique)
- `weighbridge_slip_id`
- `payment_status`
- `status`

---

### 12. company_settings
```json
{
  "id": "UUID (string)",
  "company_name": "string (required)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "pin_code": "string (optional)",
  "gstin": "string (optional)",
  "pan": "string (optional)",
  "mobile": "string (optional)",
  "email": "string (optional)",
  "bank_name": "string (optional)",
  "account_number": "string (optional)",
  "ifsc_code": "string (optional)",
  "branch": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime (optional)"
}
```

---

### 13. otp_store
```json
{
  "mobile": "string (10 digits, primary key)",
  "otp": "string (6 digits)",
  "created_at": "datetime",
  "expires_at": "datetime (5 minutes from creation)"
}
```

**Indexes:**
- `mobile` (unique)
- `expires_at` (TTL index for auto-deletion)

---

## Sequence Counters

### Format: `{type}-{year}-{counter}`

- **Weighbridge**: WBE-25-00001, WBE-25-00002...
- **Sales Pre-Entry**: SPRE-25-00001, SPRE-25-00002...
- **Sales Invoice**: SAL-25-00001, SAL-25-00002...
- **Freight Slip**: FRG-25-00001, FRG-25-00002...
- **Bill Purchase Pre-Entry**: BPRE-25-00001...
- **Bill Purchase Bill**: BPB-25-00001...
- **Farmer Payment**: FP-25-00001...

---

## Relationships

```
parties (customers) ←──── sales_pre_entries ←──── sales_invoices
parties (suppliers) ←──── bill_purchase_pre_entries ←──── bill_purchase_bills
parties (farmers) ←──── weighbridge_queue ←──── farmer_payments
items ←──── sales_pre_entries/sales_invoices
items ←──── bill_purchase_pre_entries/bills
brokers ←──── sales_pre_entries/invoices
brokers ←──── bill_purchase_pre_entries/bills
transporters ←──── (future use)
```

---

## Key Business Rules

1. **Weighbridge → Sales Flow:**
   - weighbridge_queue (transaction_type=sale) → sales_pre_entries → sales_invoices

2. **Bill Purchase Flow:**
   - bill_purchase_pre_entries → weighbridge (weigh) → bill_purchase_bills

3. **Farmer Payment Flow:**
   - weighbridge_queue (transaction_type=farmer_purchase) → farmer_payments

4. **Mixed Load:**
   - Single sales_pre_entry with is_mixed_load=true
   - Multiple line_items (one per customer/item)
   - Creates multiple sales_invoices (one per line_item)
   - All invoices reference same pre_entry_id

5. **OTP Verification:**
   - Used for farmer mobile verification
   - Auto-expires after 5 minutes
   - One OTP per mobile at a time

---

## Data Types Reference

- **UUID**: String format (e.g., "a1b2c3d4-e5f6-...")
- **Date**: ISO format string (e.g., "2025-11-03")
- **DateTime**: ISO format with timezone (e.g., "2025-11-03T12:30:00.000Z")
- **Float**: Decimal numbers (up to 2 decimal places for amounts)
- **Boolean**: true/false
- **Integer**: Whole numbers

---

**Generated:** November 2025
**Version:** 1.0
