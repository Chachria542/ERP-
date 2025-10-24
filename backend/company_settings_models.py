"""
Company Settings Module - Database Models
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BankDetails(BaseModel):
    """Bank details model"""
    bank_name: str
    account_number: str
    ifsc_code: str
    branch: str

class CompanySettings(BaseModel):
    """Company settings model"""
    id: str
    company_name: str
    company_gstin: str
    company_address: str
    company_city: str
    company_state: str
    company_pin: str
    company_phone: str
    company_email: Optional[str] = None
    
    # Statutory details
    ifssai_no: str
    
    # Bank details
    bank_details: BankDetails
    
    # Legal/Compliance
    warranty_text: str
    
    # Company assets and additional info (for print templates)
    company_logo_url: Optional[str] = None  # Path to uploaded logo (PNG/JPEG)
    godown_address: Optional[str] = None     # Static godown/mandi address
    terms_and_conditions: Optional[str] = None  # Invoice footer terms
    
    # Metadata
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: str
    updated_by: Optional[str] = None

class CompanySettingsCreate(BaseModel):
    """Model for creating/updating company settings"""
    company_name: str
    company_gstin: str
    company_address: str
    company_city: str
    company_state: str
    company_pin: str
    company_phone: str
    company_email: Optional[str] = None
    ifssai_no: str
    bank_details: BankDetails
    warranty_text: str
    company_logo_url: Optional[str] = None
    godown_address: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    created_by: str
