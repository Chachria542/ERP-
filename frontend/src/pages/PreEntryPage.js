import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TRANSACTION_TYPES = [
  { value: 'farmer_purchase', label: 'Farmer Purchase', icon: '🚜' },
  { value: 'bill_purchase', label: 'Bill Purchase', icon: '📦' },
  { value: 'sale', label: 'Sale', icon: '🚚' },
  { value: 'custody_deposit', label: 'Custody Deposit', icon: '🏦' },
  { value: 'custody_withdrawal', label: 'Custody Withdrawal', icon: '💰' },
  { value: 'internal_transfer', label: 'Internal Transfer', icon: '🔄' }
];

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

function PreEntryPage({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [createdSlip, setCreatedSlip] = useState(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [farmerConflict, setFarmerConflict] = useState(null);
  
  // OTP Verification state
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Form state
  const [transactionType, setTransactionType] = useState('farmer_purchase');
  const [fromLocation, setFromLocation] = useState('Sanawad Mandi');
  const [toLocation, setToLocation] = useState('');
  
  // Party details (dynamic based on type)
  const [partyType, setPartyType] = useState('farmer');
  const [partyName, setPartyName] = useState('');
  const [partyMobile, setPartyMobile] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  
  // Bill Purchase specific fields
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [hasBroker, setHasBroker] = useState(false);
  const [brokerName, setBrokerName] = useState('');
  const [brokerageType, setBrokerageType] = useState('none');
  const [brokerageRate, setBrokerageRate] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [expectedQuantityBags, setExpectedQuantityBags] = useState('');
  const [expectedQuantityKgs, setExpectedQuantityKgs] = useState('');
  const [expectedQuantityQtls, setExpectedQuantityQtls] = useState('');
  
  // Item details
  const [itemId, setItemId] = useState('');
  const [quality, setQuality] = useState('');
  const [expectedBags, setExpectedBags] = useState('');
  const [ratePerQtl, setRatePerQtl] = useState('');
  
  // Additional fields
  const [poNumber, setPoNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [pledgeRate, setPledgeRate] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  // OTP Timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    // Update party type based on transaction type
    const typeMap = {
      'farmer_purchase': 'farmer',
      'bill_purchase': 'trader',
      'sale': 'buyer',
      'custody_deposit': 'farmer',
      'custody_withdrawal': 'farmer',
      'internal_transfer': 'own_stock'
    };
    setPartyType(typeMap[transactionType] || 'farmer');
  }, [transactionType]);

  useEffect(() => {
    // Auto-fill rate when item is selected
    if (itemId && (transactionType === 'farmer_purchase' || transactionType === 'bill_purchase')) {
      const item = items.find(i => i.id === itemId);
      if (item && item.current_price) {
        setRatePerQtl(item.current_price.toString());
      }
    }
  }, [itemId, items, transactionType]);

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API}/items`);
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API}/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      toast.error('Failed to load suppliers');
    }
  };

  useEffect(() => {
    if (transactionType === 'bill_purchase') {
      fetchSuppliers();
    }
  }, [transactionType]);

  const handleSupplierChange = (selectedSupplierId) => {
    setSupplierId(selectedSupplierId);
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (supplier) {
      setPartyName(supplier.name);
      setPartyGstin(supplier.gstin || '');
      setPlaceOfSupply(supplier.place_of_supply || '');
    }
  };

  // OTP Verification Functions
  const handleCheckAndSendOTP = async () => {
    if (!partyMobile || partyMobile.length !== 10) {
      toast.error('Please enter valid 10-digit mobile number');
      return;
    }

    setOtpLoading(true);
    try {
      // Check if farmer exists and is verified
      const checkResponse = await axios.get(`${API}/otp/check-verification/${partyMobile}`);
      
      if (checkResponse.data.verified) {
        setOtpVerified(true);
        toast.success(`✅ Mobile already verified for ${checkResponse.data.farmer_name}`);
        return;
      }

      // Send OTP for new farmer
      const sendResponse = await axios.post(`${API}/otp/send`, { mobile: partyMobile });
      
      if (sendResponse.data.requires_otp) {
        setOtpSent(true);
        setShowOTPDialog(true);
        setOtpTimer(120); // 2 minutes
        setOtp('');
        toast.success('📱 OTP sent to ' + partyMobile);
        
        // Show mock OTP in console (for testing)
        console.log('🔑 [MOCK OTP] Check backend console for OTP');
      } else {
        setOtpVerified(true);
        toast.success('Mobile already verified');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 4) {
      toast.error('Please enter 4-digit OTP');
      return;
    }

    setOtpLoading(true);
    try {
      const response = await axios.post(`${API}/otp/verify`, {
        mobile: partyMobile,
        otp: otp
      });

      if (response.data.verified) {
        setOtpVerified(true);
        setShowOTPDialog(false);
        setOtp('');
        toast.success('✅ Mobile verified successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpLoading(true);
    try {
      await axios.post(`${API}/otp/resend`, { mobile: partyMobile });
      setResendCooldown(60); // 60 seconds cooldown
      setOtpTimer(120); // Reset timer to 2 minutes
      setOtp('');
      toast.success('📱 OTP resent to ' + partyMobile);
      console.log('🔑 [MOCK OTP] Check backend console for new OTP');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e, confirmFarmerUpdate = false) => {
    e.preventDefault();
    
    // Validation
    if (transactionType === 'bill_purchase') {
      // Bill purchase validation
      if (!supplierId || !placeOfSupply || !itemId) {
        toast.error('Please fill required fields: Supplier, Place of Supply, and Item');
        return;
      }
      
      if (hasBroker && !brokerName) {
        toast.error('Please enter broker name');
        return;
      }
    } else {
      // Farmer purchase validation
      if (!partyName || !itemId) {
        toast.error('Please fill required fields');
        return;
      }

      if (transactionType === 'farmer_purchase' && (!partyMobile || partyMobile.length !== 10)) {
        toast.error('Please enter valid 10-digit mobile number');
        return;
      }

      // OTP Verification Check (only for farmer_purchase with NEW farmers)
      if (transactionType === 'farmer_purchase' && partyMobile && !otpVerified) {
        toast.error('Please verify mobile number first');
        return;
      }
    }

    try {
      let payload, endpoint;
      
      if (transactionType === 'bill_purchase') {
        // Bill Purchase payload
        payload = {
          date: new Date().toISOString().split('T')[0],
          supplier_id: supplierId,
          supplier_gstin: partyGstin,
          place_of_supply: placeOfSupply,
          item_id: itemId,
          has_broker: hasBroker,
          broker_name: brokerName || null,
          brokerage_type: brokerageType !== 'none' ? brokerageType : null,
          brokerage_rate: brokerageRate ? parseFloat(brokerageRate) : null,
          eway_bill_no: ewayBillNo || null,
          expected_quantity_bags: expectedQuantityBags ? parseInt(expectedQuantityBags) : null,
          expected_quantity_kgs: expectedQuantityKgs ? parseFloat(expectedQuantityKgs) : null,
          expected_quantity_qtls: expectedQuantityQtls ? parseFloat(expectedQuantityQtls) : null,
          remarks: remarks || null,
          created_by: user.username
        };
        
        endpoint = `${API}/bill-purchase/pre-entry`;
      } else {
        // Farmer Purchase payload (existing logic)
        payload = {
          transaction_type: transactionType,
          from_location: fromLocation,
          to_location: toLocation || null,
          party_type: partyType,
          party_name: partyName,
          party_mobile: partyMobile || null,
          party_gstin: partyGstin || null,
          item_id: itemId,
          quality: quality || null,
          expected_bags: expectedBags ? parseInt(expectedBags) : null,
          rate_per_qtl: ratePerQtl ? parseFloat(ratePerQtl) : null,
          po_number: poNumber || null,
          order_number: orderNumber || null,
          challan_number: challanNumber || null,
          pledge_rate: pledgeRate ? parseFloat(pledgeRate) : null,
          remarks: remarks || null,
          created_by: user.id
        };

        endpoint = confirmFarmerUpdate 
          ? `${API}/pre-entry/confirm-farmer-update?confirm_update=true`
          : `${API}/pre-entry`;
      }
      
      const response = await axios.post(endpoint, payload);
      
      // Check for farmer conflict
      if (response.data.farmer_conflict) {
        setFarmerConflict(response.data);
        setShowConflictDialog(true);
        return;
      }
      
      // Success
      setCreatedSlip(response.data);
      setShowQRModal(true);
      toast.success(`Pre-Entry created! Slip ID: ${response.data.slip_id}`);
      resetForm();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create pre-entry');
    }
  };

  const handleConfirmFarmerUpdate = () => {
    setShowConflictDialog(false);
    handleSubmit({ preventDefault: () => {} }, true);
  };

  const resetForm = () => {
    setFromLocation('Sanawad Mandi');
    setToLocation('');
    setPartyName('');
    setPartyMobile('');
    setPartyGstin('');
    setItemId('');
    setQuality('');
    setExpectedBags('');
    setRatePerQtl('');
    setPoNumber('');
    setOrderNumber('');
    setChallanNumber('');
    setPledgeRate('');
    setRemarks('');
  };

  const renderDynamicFields = () => {
    const selectedType = TRANSACTION_TYPES.find(t => t.value === transactionType);
    
    return (
      <div className="space-y-6">
        {/* Transaction Type Header */}
        <div className="p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
          <h3 className="text-xl font-bold flex items-center gap-2" style={{color: '#3E2723'}}>
            <span>{selectedType?.icon}</span>
            {selectedType?.label}
          </h3>
        </div>

        {/* Location Section */}
        <div className="border-t pt-4">
          <h4 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Location Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold">From Location *</Label>
              <Input
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                placeholder="Warehouse/Mandi name"
                className="mt-1"
                required
              />
            </div>
            {transactionType === 'internal_transfer' && (
              <div>
                <Label className="text-sm font-semibold">To Location *</Label>
                <Input
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="Destination warehouse"
                  className="mt-1"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Party Section */}
        {partyType !== 'own_stock' && (
          <div className="border-t pt-4">
            <h4 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>
              {partyType === 'farmer' ? 'Farmer' : partyType === 'trader' ? 'Supplier' : 'Buyer'} Details
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-semibold">Name *</Label>
                <Input
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Party name"
                  className="mt-1"
                  required
                />
              </div>
              {(partyType === 'farmer' || transactionType === 'sale') && (
                <div>
                  <Label className="text-sm font-semibold">Mobile {partyType === 'farmer' ? '*' : ''}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={partyMobile}
                      onChange={(e) => {
                        setPartyMobile(e.target.value);
                        setOtpVerified(false); // Reset verification on mobile change
                      }}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      className="flex-1"
                      required={partyType === 'farmer'}
                    />
                    {partyType === 'farmer' && partyMobile.length === 10 && (
                      <Button
                        type="button"
                        onClick={handleCheckAndSendOTP}
                        disabled={otpVerified || otpLoading}
                        className={otpVerified ? 'bg-green-600 hover:bg-green-700' : 'btn-primary'}
                      >
                        {otpVerified ? '✅ Verified' : otpLoading ? '⏳...' : '📱 Verify'}
                      </Button>
                    )}
                  </div>
                  {otpVerified && (
                    <p className="text-xs text-green-600 mt-1">✅ Mobile verified</p>
                  )}
                </div>
              )}
              {transactionType === 'bill_purchase' && (
                <div>
                  <Label className="text-sm font-semibold">GSTIN</Label>
                  <Input
                    value={partyGstin}
                    onChange={(e) => setPartyGstin(e.target.value)}
                    placeholder="GST number"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Item Section */}
        <div className="border-t pt-4">
          <h4 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Item Details</h4>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-semibold">Item *</Label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="erp-select mt-1"
                required
              >
                <option value="">Select Item</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Quality/Grade</Label>
              <Input
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                placeholder="Grade A, B, C"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Expected Bags</Label>
              <Input
                type="number"
                value={expectedBags}
                onChange={(e) => setExpectedBags(e.target.value)}
                placeholder="Estimated quantity"
                className="mt-1"
              />
            </div>
            {(transactionType === 'farmer_purchase' || transactionType === 'bill_purchase' || transactionType === 'sale') && (
              <div>
                <Label className="text-sm font-semibold">Rate per Qtl {transactionType !== 'sale' ? '*' : ''}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratePerQtl}
                  onChange={(e) => setRatePerQtl(e.target.value)}
                  placeholder="₹ per quintal"
                  className="mt-1"
                  required={transactionType !== 'sale'}
                />
              </div>
            )}
          </div>
        </div>

        {/* Transaction-Specific Fields */}
        {(transactionType === 'bill_purchase' || transactionType === 'sale' || transactionType === 'internal_transfer' || transactionType === 'custody_deposit') && (
          <div className="border-t pt-4">
            <h4 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Additional Details</h4>
            <div className="grid grid-cols-3 gap-4">
              {transactionType === 'bill_purchase' && (
                <div>
                  <Label className="text-sm font-semibold">PO Number</Label>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Purchase order number"
                    className="mt-1"
                  />
                </div>
              )}
              {transactionType === 'sale' && (
                <div>
                  <Label className="text-sm font-semibold">Order Number</Label>
                  <Input
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Sales order number"
                    className="mt-1"
                  />
                </div>
              )}
              {transactionType === 'internal_transfer' && (
                <div>
                  <Label className="text-sm font-semibold">Challan Number</Label>
                  <Input
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    placeholder="Delivery challan"
                    className="mt-1"
                  />
                </div>
              )}
              {transactionType === 'custody_deposit' && (
                <div>
                  <Label className="text-sm font-semibold">Pledge Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pledgeRate}
                    onChange={(e) => setPledgeRate(e.target.value)}
                    placeholder="₹ per quintal"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remarks */}
        <div className="border-t pt-4">
          <Label className="text-sm font-semibold">Remarks / Notes</Label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Any additional notes"
            className="w-full mt-1 p-2 border rounded-md"
            rows={3}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Pre-Entry (Office)</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Create pre-slip before truck arrives</p>
          </div>
          
          <Button 
            onClick={() => setShowForm(true)} 
            className="btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Pre-Entry
          </Button>
        </div>

        {/* Info Card */}
        <Card className="p-6" style={{background: 'linear-gradient(135deg, rgba(107, 142, 35, 0.1) 0%, rgba(212, 175, 55, 0.1) 100%)'}}>
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>
            📋 Pre-Entry Process
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-4xl mb-2">1️⃣</div>
              <p className="font-bold" style={{color: '#6B8E23'}}>Select Type</p>
              <p className="text-sm" style={{color: '#6B5846'}}>Purchase, Sale, Transfer, etc.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">2️⃣</div>
              <p className="font-bold" style={{color: '#6B8E23'}}>Enter Details</p>
              <p className="text-sm" style={{color: '#6B5846'}}>Party, item, expected quantity</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">3️⃣</div>
              <p className="font-bold" style={{color: '#6B8E23'}}>Generate Slip</p>
              <p className="text-sm" style={{color: '#6B5846'}}>Get slip ID and QR code</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">4️⃣</div>
              <p className="font-bold" style={{color: '#6B8E23'}}>Share with Driver</p>
              <p className="text-sm" style={{color: '#6B5846'}}>Print/WhatsApp to driver</p>
            </div>
          </div>
        </Card>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl" style={{color: '#3E2723'}}>
                Create Pre-Entry
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Transaction Type Selector */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Transaction Type *</Label>
                <div className="grid grid-cols-3 gap-3">
                  {TRANSACTION_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setTransactionType(type.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        transactionType === type.value
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      <div className="text-3xl mb-2">{type.icon}</div>
                      <div className="font-semibold text-sm">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Fields */}
              {renderDynamicFields()}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }} 
                  className="btn-secondary"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="btn-primary"
                >
                  Create Pre-Entry & Generate QR
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* QR Code Modal */}
        <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center" style={{color: '#3E2723'}}>
                ✅ Pre-Entry Created!
              </DialogTitle>
            </DialogHeader>
            
            {createdSlip && (
              <div className="space-y-4">
                <div className="text-center p-6 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                  <p className="text-sm mb-2" style={{color: '#6B5846'}}>Slip ID</p>
                  <p className="text-3xl font-bold" style={{color: '#6B8E23'}}>{createdSlip.slip_id}</p>
                </div>
                
                <div className="text-center p-4 border-2 border-dashed rounded-lg">
                  <div className="text-6xl mb-2">📱</div>
                  <p className="text-sm" style={{color: '#6B5846'}}>QR Code</p>
                  <p className="text-xs mt-2 font-mono bg-gray-100 p-2 rounded">{createdSlip.qr_code}</p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => window.print()} 
                    className="btn-secondary flex-1"
                  >
                    🖨️ Print
                  </Button>
                  <Button 
                    onClick={() => setShowQRModal(false)} 
                    className="btn-primary flex-1"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Farmer Conflict Dialog */}
        <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Farmer Name Conflict</DialogTitle>
            </DialogHeader>
            
            {farmerConflict && (
              <div className="space-y-4">
                <p>Mobile <strong>{farmerConflict.mobile}</strong> exists with name:</p>
                <div className="p-3 bg-yellow-50 rounded">
                  <p className="font-bold">Existing: {farmerConflict.existing_name}</p>
                </div>
                <p>You entered:</p>
                <div className="p-3 bg-blue-50 rounded">
                  <p className="font-bold">New: {farmerConflict.new_name}</p>
                </div>
                <p className="text-sm text-gray-600">Do you want to update the farmer name?</p>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowConflictDialog(false)} 
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmFarmerUpdate} 
                    className="btn-primary flex-1"
                  >
                    Yes, Update
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* OTP Verification Dialog */}
        <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center" style={{color: '#3E2723'}}>
                📱 Mobile Verification
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Instructions */}
              <div className="text-center p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                <p className="text-sm mb-2" style={{color: '#6B5846'}}>
                  Enter 4-digit OTP sent to
                </p>
                <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>{partyMobile}</p>
                <p className="text-xs mt-2 text-gray-500">
                  🔑 [MOCK MODE] Check backend console for OTP
                </p>
              </div>

              {/* OTP Input */}
              <div>
                <Label className="text-sm font-semibold">Enter OTP</Label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="****"
                  maxLength={4}
                  className="mt-1 text-center text-2xl tracking-widest font-bold"
                  autoFocus
                />
              </div>

              {/* Timer */}
              <div className="text-center">
                {otpTimer > 0 ? (
                  <p className="text-sm">
                    ⏱️ OTP expires in: <strong className="text-red-600">{Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-red-600">⚠️ OTP expired. Please resend.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleResendOTP}
                  disabled={resendCooldown > 0 || otpLoading}
                  className="btn-secondary"
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : '🔄 Resend OTP'}
                </Button>
                <Button
                  onClick={handleVerifyOTP}
                  disabled={otp.length !== 4 || otpLoading}
                  className="btn-primary"
                >
                  {otpLoading ? '⏳ Verifying...' : '✅ Verify'}
                </Button>
              </div>

              {/* Help Text */}
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Didn't receive OTP? Wait {resendCooldown > 0 ? resendCooldown : 60} seconds to resend
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default PreEntryPage;
