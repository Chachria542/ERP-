import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import SupplierAutocomplete from '../components/SupplierAutocomplete';
import CustomerAutocomplete from '../components/CustomerAutocomplete';
import BrokerAutocomplete from '../components/BrokerAutocomplete';
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

  // Farmer check states (for mobile-first flow)
  const [farmerExists, setFarmerExists] = useState(false);
  const [farmerChecked, setFarmerChecked] = useState(false);
  const [checkingFarmer, setCheckingFarmer] = useState(false);
  const [farmerFieldsLocked, setFarmerFieldsLocked] = useState(false);

  // Form state
  const [transactionType, setTransactionType] = useState('farmer_purchase');
  const [fromLocation, setFromLocation] = useState('Sanawad Mandi');
  const [toLocation, setToLocation] = useState('');
  
  // Party details (dynamic based on type)
  const [partyType, setPartyType] = useState('farmer');
  const [partyName, setPartyName] = useState('');
  const [partyMobile, setPartyMobile] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyVillage, setPartyVillage] = useState(''); // Village for farmer transactions
  
  // Bill Purchase specific fields
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [hasBroker, setHasBroker] = useState(false);
  const [brokerId, setBrokerId] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerageType, setBrokerageType] = useState('none');
  const [brokerageRate, setBrokerageRate] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  
  // Sale specific fields
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [marka, setMarka] = useState('');
  const [markaOptions, setMarkaOptions] = useState([]);
  const [bharti, setBharti] = useState(50);
  const [expectedWeight, setExpectedWeight] = useState('');
  
  // Mixed Load state
  const [isMixedLoad, setIsMixedLoad] = useState(false);
  const [mixedLoadCustomers, setMixedLoadCustomers] = useState([
    {
      id: Date.now(),
      customer_id: '',
      customer_name: '',
      customer_gstin: '',
      place_of_supply: '',
      line_items: [
        {
          id: Date.now(),
          item_id: '',
          item_name: '',
          marka: '',
          bharti: 50,
          expected_bags: '',
          expected_weight: '',
          item_rate: ''
        }
      ]
    }
  ]);
  
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
    fetchCustomers();
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
  // No longer auto-filling rate - will be entered during bill creation
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

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/parties`);
      // Filter customers only
      const customerList = response.data.filter(party => 
        party.roles && party.roles.includes('customer')
      );
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    }
  };

  // Handle customer selection for sales
  const handleCustomerSelect = (customerId) => {
    setCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerGstin(customer.gstin || '');
      setPlaceOfSupply(customer.place_of_supply || '');
    }
  };

  // Fetch marka options for selected item
  const fetchMarkaOptions = async (itemId) => {
    try {
      const response = await axios.get(`${API}/sales/marka/${itemId}`);
      setMarkaOptions(response.data);
    } catch (error) {
      console.error('Error fetching marka options:', error);
      setMarkaOptions([]);
    }
  };

  // Handle order number auto-fetch
  const handleOrderNumberBlur = async () => {
    if (!orderNumber || transactionType !== 'sale') return;
    
    try {
      const response = await axios.get(`${API}/sales/order/${orderNumber}`);
      if (response.data) {
        toast.info('Order details loaded');
        // Auto-fill from order
        if (response.data.customer_id) {
          setCustomerId(response.data.customer_id);
          handleCustomerSelect(response.data.customer_id);
        }
        if (response.data.item_id) {
          setItemId(response.data.item_id);
          const item = items.find(i => i.id === response.data.item_id);
          if (item) {
            setRatePerQtl(item.current_price?.toString() || '');
          }
          fetchMarkaOptions(response.data.item_id);
        }
        if (response.data.marka) setMarka(response.data.marka);
        if (response.data.expected_weight) setExpectedWeight(response.data.expected_weight.toString());
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('Order not found - proceed with manual entry');
      } else {
        console.error('Error fetching order:', error);
      }
    }
  };

  useEffect(() => {
    if (transactionType === 'bill_purchase') {
      fetchSuppliers();
    } else if (transactionType === 'sale') {
      // Set default for sale
      setHasBroker(true);
      setBrokerageType('per_quintal');
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

  // Farmer Check Function (Mobile-First Flow)
  const handleMobileBlur = async () => {
    // Only check for farmer party type
    if (partyType !== 'farmer' || !partyMobile || partyMobile.length !== 10) {
      return;
    }
    
    setCheckingFarmer(true);
    try {
      const response = await axios.get(`${API}/farmers/check/${partyMobile}`);
      
      // Farmer exists - auto-fill and lock fields
      const farmer = response.data.farmer;
      setPartyName(farmer.name);
      setPartyVillage(farmer.village);
      setFarmerExists(true);
      setFarmerFieldsLocked(true);
      setOtpVerified(true); // Already verified farmer
      toast.success(`✅ Farmer found: ${farmer.name} from ${farmer.village}`);
      
    } catch (error) {
      if (error.response?.status === 404) {
        // New farmer - enable fields for input
        setPartyName('');
        setPartyVillage('');
        setFarmerExists(false);
        setFarmerFieldsLocked(false);
        setOtpVerified(false);
        toast.info('📝 New farmer - please fill details and verify mobile');
      } else {
        toast.error('Error checking farmer');
      }
    } finally {
      setCheckingFarmer(false);
      setFarmerChecked(true);
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
        
        // IMPORTANT: Lock fields immediately for new farmers after OTP verification
        if (!farmerExists && partyType === 'farmer') {
          setFarmerFieldsLocked(true); // Lock fields FIRST
          
          // Then register farmer if name and village are provided
          if (partyName && partyVillage) {
            try {
              const registerResponse = await axios.post(`${API}/farmers/register`, {
                mobile: partyMobile,
                name: partyName,
                village: partyVillage
              });
              
              setFarmerExists(true);
              toast.success('✅ Farmer registered in master data!');
            } catch (regError) {
              console.error('Farmer registration error:', regError);
              toast.error('Mobile verified, but farmer registration failed. Please try again.');
              // Keep fields locked even if registration fails
            }
          }
        }
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
    } else if (transactionType === 'sale') {
      // Sale validation
      if (!customerId || !placeOfSupply) {
        toast.error('Customer and Place of Supply are required');
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

      // New validation: Farmer must be checked and verified
      if (transactionType === 'farmer_purchase' && partyType === 'farmer') {
        if (!farmerChecked) {
          toast.error('Please enter mobile number and wait for farmer check');
          return;
        }
        
        if (!farmerExists && !otpVerified) {
          toast.error('Please verify mobile and register new farmer first');
          return;
        }
        
        if (!farmerExists && !partyVillage) {
          toast.error('Please enter village name');
          return;
        }
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
          quality: quality || null,
          expected_bags: expectedBags ? parseInt(expectedBags) : null,
          rate_per_qtl: ratePerQtl ? parseFloat(ratePerQtl) : null,
          has_broker: hasBroker,
          broker_id: brokerId || null,
          broker_name: brokerName || null,
          brokerage_type: brokerageType !== 'none' ? brokerageType : null,
          brokerage_rate: brokerageRate ? parseFloat(brokerageRate) : null,
          eway_bill_no: ewayBillNo || null,
          remarks: remarks || null,
          created_by: user.username
        };
        
        endpoint = `${API}/bill-purchase/pre-entry`;
      } else if (transactionType === 'sale') {
        // Sale payload
        if (isMixedLoad) {
          // Mixed Load payload
          const processedLineItems = [];
          
          for (const customer of mixedLoadCustomers) {
            if (!customer.customer_id || !customer.place_of_supply) {
              toast.error('Please fill all customer details');
              return;
            }
            
            for (const lineItem of customer.line_items) {
              if (!lineItem.item_id || !lineItem.expected_weight || !lineItem.item_rate) {
                toast.error('Please fill all line item details (Item, Expected Weight, Rate)');
                return;
              }
              
              processedLineItems.push({
                customer_id: customer.customer_id,
                customer_name: customer.customer_name,
                customer_gstin: customer.customer_gstin || null,
                place_of_supply: customer.place_of_supply,
                item_id: lineItem.item_id,
                item_name: lineItem.item_name,
                marka: lineItem.marka || null,
                bharti: lineItem.bharti || 50,
                expected_bags: lineItem.expected_bags ? parseInt(lineItem.expected_bags) : Math.floor(parseFloat(lineItem.expected_weight) / lineItem.bharti),
                expected_weight: parseFloat(lineItem.expected_weight)
              });
            }
          }
          
          payload = {
            date: new Date().toISOString().split('T')[0],
            order_number: orderNumber || null,
            is_mixed_load: true,
            line_items: processedLineItems,
            has_broker: hasBroker,
            broker_id: brokerId || null,
            broker_name: brokerName || null,
            brokerage_type: hasBroker && brokerageType !== 'none' ? brokerageType : null,
            brokerage_rate: hasBroker && brokerageRate ? parseFloat(brokerageRate) : null,
            remarks: remarks || null,
            created_by: user.username
          };
        } else {
          // Single Load payload
          payload = {
            date: new Date().toISOString().split('T')[0],
            order_number: orderNumber || null,
            customer_id: customerId,
            customer_gstin: customerGstin || null,
            place_of_supply: placeOfSupply,
            item_id: itemId || null,
            marka: marka || null,
            bharti: bharti,
            expected_weight: expectedWeight ? parseFloat(expectedWeight) : null,
            has_broker: hasBroker,
            broker_id: brokerId || null,
            broker_name: brokerName || null,
            brokerage_type: hasBroker && brokerageType !== 'none' ? brokerageType : null,
            brokerage_rate: hasBroker && brokerageRate ? parseFloat(brokerageRate) : null,
            remarks: remarks || null,
            created_by: user.username
          };
        }
        
        endpoint = `${API}/sales/pre-entry`;
      } else {
        // Farmer Purchase payload (existing logic)
        payload = {
          transaction_type: transactionType,
          from_location: fromLocation,
          to_location: toLocation || null,
          party_type: partyType,
          party_name: partyName,
          party_mobile: partyMobile || null,
          party_village: partyVillage || null,  // Village for farmers
          party_gstin: partyType !== 'farmer' ? (partyGstin || null) : null,  // Only send GSTIN for non-farmers
          item_id: itemId,
          quality: quality || null,
          expected_bags: expectedBags ? parseInt(expectedBags) : null,
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

  // Mixed Load Handlers
  const addMixedLoadCustomer = () => {
    setMixedLoadCustomers([
      ...mixedLoadCustomers,
      {
        id: Date.now(),
        customer_id: '',
        customer_name: '',
        customer_gstin: '',
        place_of_supply: '',
        line_items: [
          {
            id: Date.now(),
            item_id: '',
            item_name: '',
            marka: '',
            bharti: 50,
            expected_bags: '',
            expected_weight: '',
            item_rate: ''
          }
        ]
      }
    ]);
  };

  const removeMixedLoadCustomer = (customerIndex) => {
    if (mixedLoadCustomers.length === 1) {
      toast.error('At least one customer is required');
      return;
    }
    setMixedLoadCustomers(mixedLoadCustomers.filter((_, index) => index !== customerIndex));
  };

  const updateMixedLoadCustomer = (customerIndex, field, value) => {
    const updated = [...mixedLoadCustomers];
    updated[customerIndex][field] = value;
    setMixedLoadCustomers(updated);
  };

  const addLineItem = (customerIndex) => {
    const updated = [...mixedLoadCustomers];
    updated[customerIndex].line_items.push({
      id: Date.now(),
      item_id: '',
      item_name: '',
      marka: '',
      bharti: 50,
      expected_bags: '',
      expected_weight: '',
      item_rate: ''
    });
    setMixedLoadCustomers(updated);
  };

  const removeLineItem = (customerIndex, lineIndex) => {
    const updated = [...mixedLoadCustomers];
    if (updated[customerIndex].line_items.length === 1) {
      toast.error('At least one line item is required per customer');
      return;
    }
    updated[customerIndex].line_items = updated[customerIndex].line_items.filter((_, index) => index !== lineIndex);
    setMixedLoadCustomers(updated);
  };

  const updateLineItem = (customerIndex, lineIndex, field, value) => {
    const updated = [...mixedLoadCustomers];
    updated[customerIndex].line_items[lineIndex][field] = value;
    
    // Auto-calculate expected_weight if bags and bharti are provided
    if (field === 'expected_bags' || field === 'bharti') {
      const bags = parseFloat(updated[customerIndex].line_items[lineIndex].expected_bags) || 0;
      const bharti = parseFloat(updated[customerIndex].line_items[lineIndex].bharti) || 50;
      updated[customerIndex].line_items[lineIndex].expected_weight = (bags * bharti).toString();
    }
    
    setMixedLoadCustomers(updated);
  };

  const resetForm = () => {
    setFromLocation('Sanawad Mandi');
    setToLocation('');
    setPartyName('');
    setPartyMobile('');
    setPartyGstin('');
    setPartyVillage(''); // Reset village field
    setItemId('');
    setQuality('');
    setExpectedBags('');
    setPoNumber('');
    setOrderNumber('');
    setChallanNumber('');
    setPledgeRate('');
    setRemarks('');
    
    // Reset Farmer check states
    setFarmerExists(false);
    setFarmerChecked(false);
    setCheckingFarmer(false);
    setFarmerFieldsLocked(false);
    setOtpVerified(false);
    
    // Reset Bill Purchase fields
    setSupplierId('');
    setPlaceOfSupply('');
    setHasBroker(false);
    setBrokerName('');
    setBrokerageType('none');
    setBrokerageRate('');
    setEwayBillNo('');
    
    // Reset Sale fields
    setCustomerId('');
    setCustomerName('');
    setCustomerGstin('');
    setMarka('');
    setBharti(50);
    setExpectedWeight('');
    
    // Reset Mixed Load
    setIsMixedLoad(false);
    setMixedLoadCustomers([
      {
        id: Date.now(),
        customer_id: '',
        customer_name: '',
        customer_gstin: '',
        place_of_supply: '',
        line_items: [
          {
            id: Date.now(),
            item_id: '',
            item_name: '',
            marka: '',
            bharti: 50,
            expected_bags: '',
            expected_weight: '',
            item_rate: ''
          }
        ]
      }
    ]);
    
    // Reset Sale fields
    setCustomerId('');
    setCustomerName('');
    setCustomerGstin('');
    setMarka('');
    setMarkaOptions([]);
    setBharti(50);
    setExpectedWeight('');
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
            
            {transactionType === 'bill_purchase' ? (
              // Bill Purchase specific fields
              <div className="space-y-4">
                {/* Smart Supplier Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Supplier *</Label>
                    <SupplierAutocomplete
                      value={partyName}
                      onSelect={(supplier) => {
                        setSupplierId(supplier.id);
                        setPartyName(supplier.name);
                        setPartyGstin(supplier.gstin || '');
                        setPlaceOfSupply(supplier.place_of_supply || '');
                      }}
                      placeholder="Type supplier name..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Supplier GSTIN</Label>
                    <Input
                      value={partyGstin}
                      onChange={(e) => setPartyGstin(e.target.value)}
                      placeholder="Auto-filled from supplier"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Place of Supply *</Label>
                    <Input
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      placeholder="e.g., Mumbai, Maharashtra"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">E-Way Bill No.</Label>
                    <Input
                      value={ewayBillNo}
                      onChange={(e) => setEwayBillNo(e.target.value)}
                      placeholder="Optional"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Broker Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_broker"
                      checked={hasBroker}
                      onCheckedChange={setHasBroker}
                    />
                    <Label htmlFor="has_broker">Has Broker</Label>
                  </div>

                  {hasBroker && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-semibold">Broker Name *</Label>
                        <BrokerAutocomplete
                          value={brokerName}
                          onSelect={(broker) => {
                            setBrokerId(broker.id);
                            setBrokerName(broker.name);
                            setBrokerageType(broker.default_brokerage_type || 'per_quintal');
                            setBrokerageRate(broker.default_brokerage_rate || '');
                          }}
                          placeholder="Type broker name..."
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Brokerage Type</Label>
                        <Select value={brokerageType} onValueChange={setBrokerageType}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BROKERAGE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {brokerageType !== 'none' && (
                        <div>
                          <Label className="text-sm font-semibold">
                            Brokerage Rate {brokerageType === 'percentage' ? '(%)' : '(₹)'}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={brokerageRate}
                            onChange={(e) => setBrokerageRate(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Transporter (Optional) */}
                <div className="border rounded-lg p-4">
                </div>
              </div>
            ) : transactionType === 'sale' ? (
              // Sale specific fields - WITH MIXED LOAD SUPPORT
              <div className="space-y-4">
                {/* Order Number Section */}
                <div className="border rounded-lg p-4">
                  <Label className="text-sm font-semibold">Order Number (Optional)</Label>
                  <Input
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onBlur={handleOrderNumberBlur}
                    placeholder="Enter order number..."
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ℹ️ Auto-fetches customer & item details when order exists
                  </p>
                </div>

                {/* Mixed Load Toggle */}
                <div className="border rounded-lg p-4 bg-purple-50">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_mixed_load"
                      checked={isMixedLoad}
                      onCheckedChange={(checked) => {
                        setIsMixedLoad(checked);
                        if (!checked) {
                          // Reset mixed load state when toggling off
                          setMixedLoadCustomers([
                            {
                              id: Date.now(),
                              customer_id: '',
                              customer_name: '',
                              customer_gstin: '',
                              place_of_supply: '',
                              line_items: [
                                {
                                  id: Date.now(),
                                  item_id: '',
                                  item_name: '',
                                  marka: '',
                                  bharti: 50,
                                  expected_bags: '',
                                  expected_weight: '',
                                  item_rate: ''
                                }
                              ]
                            }
                          ]);
                        }
                      }}
                    />
                    <Label htmlFor="is_mixed_load" className="font-semibold text-purple-700">
                      📦 Mixed Load (Multiple Customers/Items)
                    </Label>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    Enable this for orders with multiple customers and/or multiple items in one vehicle
                  </p>
                </div>

                {isMixedLoad ? (
                  // MIXED LOAD MODE
                  <div className="space-y-4">
                    {/* Broker Section (Common for all) */}
                    <div className="border rounded-lg p-4 space-y-4 bg-blue-50">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="has_broker_mixed"
                          checked={hasBroker}
                          onCheckedChange={setHasBroker}
                        />
                        <Label htmlFor="has_broker_mixed" className="font-medium">Has Broker (Common for all customers)</Label>
                      </div>

                      {hasBroker && (
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm font-semibold">Broker Name</Label>
                            <BrokerAutocomplete
                              value={brokerName}
                              onSelect={(broker) => {
                                setBrokerId(broker.id);
                                setBrokerName(broker.name);
                                setBrokerageType(broker.default_brokerage_type || 'per_quintal');
                                setBrokerageRate(broker.default_brokerage_rate || '');
                              }}
                              placeholder="Type broker name..."
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-semibold">Brokerage Type</Label>
                            <Select value={brokerageType} onValueChange={setBrokerageType}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BROKERAGE_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {brokerageType !== 'none' && (
                            <div>
                              <Label className="text-sm font-semibold">
                                Rate {brokerageType === 'percentage' ? '(%)' : '(₹)'}
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={brokerageRate}
                                onChange={(e) => setBrokerageRate(e.target.value)}
                                placeholder="0.00"
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Customer Sections */}
                    {mixedLoadCustomers.map((customer, customerIndex) => (
                      <div key={customer.id} className="border-2 border-purple-300 rounded-lg p-4 space-y-4 bg-white">
                        <div className="flex justify-between items-center">
                          <h5 className="font-semibold text-purple-700">
                            👤 Customer {customerIndex + 1}
                          </h5>
                          {mixedLoadCustomers.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeMixedLoadCustomer(customerIndex)}
                            >
                              ❌ Remove Customer
                            </Button>
                          )}
                        </div>

                        {/* Customer Details */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-semibold">Customer *</Label>
                            <CustomerAutocomplete
                              value={customer.customer_name}
                              onSelect={(selectedCustomer) => {
                                updateMixedLoadCustomer(customerIndex, 'customer_id', selectedCustomer.id);
                                updateMixedLoadCustomer(customerIndex, 'customer_name', selectedCustomer.name);
                                updateMixedLoadCustomer(customerIndex, 'customer_gstin', selectedCustomer.gstin || '');
                                updateMixedLoadCustomer(customerIndex, 'place_of_supply', selectedCustomer.place_of_supply || '');
                              }}
                              placeholder="Type customer name..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-semibold">GSTIN</Label>
                            <Input
                              value={customer.customer_gstin}
                              onChange={(e) => updateMixedLoadCustomer(customerIndex, 'customer_gstin', e.target.value)}
                              placeholder="Auto-filled"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">Place of Supply *</Label>
                          <Input
                            value={customer.place_of_supply}
                            onChange={(e) => updateMixedLoadCustomer(customerIndex, 'place_of_supply', e.target.value)}
                            placeholder="e.g., Mumbai, Maharashtra"
                            className="mt-1"
                            required
                          />
                        </div>

                        {/* Line Items for this Customer */}
                        <div className="border-l-4 border-green-500 pl-4 space-y-3">
                          <h6 className="font-medium text-green-700">📦 Line Items</h6>
                          
                          {customer.line_items.map((lineItem, lineIndex) => (
                            <div key={lineItem.id} className="border border-green-200 rounded-lg p-3 space-y-3 bg-green-50">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-green-700">Item {lineIndex + 1}</span>
                                {customer.line_items.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeLineItem(customerIndex, lineIndex)}
                                    className="text-red-600 border-red-300"
                                  >
                                    🗑️ Remove
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs font-semibold">Item *</Label>
                                  <select
                                    value={lineItem.item_id}
                                    onChange={(e) => {
                                      const selectedItemId = e.target.value;
                                      updateLineItem(customerIndex, lineIndex, 'item_id', selectedItemId);
                                      const selectedItem = items.find(item => item.id === selectedItemId);
                                      if (selectedItem) {
                                        updateLineItem(customerIndex, lineIndex, 'item_name', selectedItem.name);
                                        if (selectedItem.current_price) {
                                          updateLineItem(customerIndex, lineIndex, 'item_rate', selectedItem.current_price.toString());
                                        }
                                      }
                                    }}
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
                                  <Label className="text-xs font-semibold">Marka</Label>
                                  <Input
                                    value={lineItem.marka}
                                    onChange={(e) => updateLineItem(customerIndex, lineIndex, 'marka', e.target.value)}
                                    placeholder="Brand"
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs font-semibold">Pack Size</Label>
                                  <Select 
                                    value={lineItem.bharti.toString()} 
                                    onValueChange={(val) => updateLineItem(customerIndex, lineIndex, 'bharti', parseInt(val))}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="100">100 kg</SelectItem>
                                      <SelectItem value="50">50 kg</SelectItem>
                                      <SelectItem value="30">30 kg</SelectItem>
                                      <SelectItem value="25">25 kg</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs font-semibold">Expected Bags</Label>
                                  <Input
                                    type="number"
                                    value={lineItem.expected_bags}
                                    onChange={(e) => updateLineItem(customerIndex, lineIndex, 'expected_bags', e.target.value)}
                                    placeholder="No. of bags"
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs font-semibold">Expected Weight (kg) *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={lineItem.expected_weight}
                                    onChange={(e) => updateLineItem(customerIndex, lineIndex, 'expected_weight', e.target.value)}
                                    placeholder="In kg"
                                    className="mt-1"
                                    required
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs font-semibold">Rate/Qtl (₹) *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={lineItem.item_rate}
                                    onChange={(e) => updateLineItem(customerIndex, lineIndex, 'item_rate', e.target.value)}
                                    placeholder="Rate"
                                    className="mt-1"
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Add Line Item Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addLineItem(customerIndex)}
                            className="w-full border-green-300 text-green-700 hover:bg-green-100"
                          >
                            ➕ Add Line Item
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Add Customer Button */}
                    <Button
                      type="button"
                      onClick={addMixedLoadCustomer}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      ➕ Add Customer
                    </Button>
                  </div>
                ) : (
                  // SINGLE LOAD MODE (Original form)
                  <>
                    {/* Customer Details Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <h5 className="font-medium">Customer Details</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold">Customer *</Label>
                          <CustomerAutocomplete
                            value={customerName}
                            onSelect={(customer) => {
                              setCustomerId(customer.id);
                              setCustomerName(customer.name);
                              setCustomerGstin(customer.gstin || '');
                              setPlaceOfSupply(customer.place_of_supply || '');
                            }}
                            placeholder="Type customer name..."
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold">GSTIN</Label>
                          <Input
                            value={customerGstin}
                            onChange={(e) => setCustomerGstin(e.target.value)}
                            placeholder="Auto-filled"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Place of Supply *</Label>
                        <Input
                          value={placeOfSupply}
                          onChange={(e) => setPlaceOfSupply(e.target.value)}
                          placeholder="e.g., Mumbai, Maharashtra"
                          className="mt-1"
                          required
                        />
                      </div>
                    </div>

                    {/* Broker Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="has_broker_sale"
                          checked={hasBroker}
                          onCheckedChange={setHasBroker}
                        />
                        <Label htmlFor="has_broker_sale" className="font-medium">Has Broker</Label>
                      </div>

                      {hasBroker && (
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm font-semibold">Broker Name</Label>
                            <BrokerAutocomplete
                              value={brokerName}
                              onSelect={(broker) => {
                                setBrokerId(broker.id);
                                setBrokerName(broker.name);
                                setBrokerageType(broker.default_brokerage_type || 'per_quintal');
                                setBrokerageRate(broker.default_brokerage_rate || '');
                              }}
                              placeholder="Type broker name..."
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-semibold">Brokerage Type</Label>
                            <Select value={brokerageType} onValueChange={setBrokerageType}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BROKERAGE_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {brokerageType !== 'none' && (
                            <div>
                              <Label className="text-sm font-semibold">
                                Rate {brokerageType === 'percentage' ? '(%)' : '(₹)'}
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={brokerageRate}
                                onChange={(e) => setBrokerageRate(e.target.value)}
                                placeholder="0.00"
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Item & Marka Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <h5 className="font-medium">Item & Marka</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold">Item *</Label>
                          <select
                            value={itemId}
                            onChange={(e) => {
                              const selectedItemId = e.target.value;
                              setItemId(selectedItemId);
                              const selectedItem = items.find(item => item.id === selectedItemId);
                              if (selectedItem && selectedItem.current_price) {
                                setRatePerQtl(selectedItem.current_price.toString());
                              }
                              fetchMarkaOptions(selectedItemId);
                            }}
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
                          <Label className="text-sm font-semibold">Rate per Qtl (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={ratePerQtl}
                            onChange={(e) => setRatePerQtl(e.target.value)}
                            placeholder="Auto-filled"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Marka (Brand)</Label>
                        {markaOptions.length > 0 ? (
                          <select
                            value={marka}
                            onChange={(e) => setMarka(e.target.value)}
                            className="erp-select mt-1"
                          >
                            <option value="">Type or select...</option>
                            {markaOptions.map((m, idx) => (
                              <option key={idx} value={m.marka}>
                                {m.marka}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            value={marka}
                            onChange={(e) => setMarka(e.target.value)}
                            placeholder="Enter marka"
                            className="mt-1"
                          />
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          💡 Dropdown shows previously used markas
                        </p>
                      </div>
                    </div>

                    {/* Pack Size & Expected Weight Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <h5 className="font-medium">Pack Size & Expected Weight</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold">Pack Size (Bharti) *</Label>
                          <Select value={bharti.toString()} onValueChange={(val) => setBharti(parseInt(val))}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="100">100 kg</SelectItem>
                              <SelectItem value="50">50 kg</SelectItem>
                              <SelectItem value="30">30 kg</SelectItem>
                              <SelectItem value="25">25 kg</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">Expected Weight (Optional)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={expectedWeight}
                            onChange={(e) => setExpectedWeight(e.target.value)}
                            placeholder="In quintals"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter expected weight in quintals
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              // Farmer Purchase fields - Mobile-First Flow
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Mobile - Always first, triggers farmer check */}
                  {(partyType === 'farmer' || transactionType === 'sale') && (
                    <div>
                      <Label className="text-sm font-semibold">Mobile {partyType === 'farmer' ? '*' : ''}</Label>
                      <div className="space-y-2 mt-1">
                        <Input
                          value={partyMobile}
                          onChange={(e) => {
                            setPartyMobile(e.target.value);
                            setOtpVerified(false);
                            setFarmerChecked(false);
                            setFarmerExists(false);
                            setFarmerFieldsLocked(false);
                          }}
                          onBlur={handleMobileBlur}
                          placeholder="Enter 10-digit mobile"
                          maxLength={10}
                          className="flex-1"
                          required={partyType === 'farmer'}
                        />
                        {checkingFarmer && (
                          <p className="text-xs text-blue-600">🔍 Checking farmer...</p>
                        )}
                        {farmerExists && !checkingFarmer && (
                          <p className="text-xs text-green-600">✅ Existing farmer - details auto-filled</p>
                        )}
                        {farmerChecked && !farmerExists && !otpVerified && !checkingFarmer && (
                          <p className="text-xs text-orange-600">📝 New farmer - fill details below</p>
                        )}
                        {!farmerExists && otpVerified && !checkingFarmer && (
                          <p className="text-xs text-blue-600">✅ Verified</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Name - Locked if farmer exists OR verified */}
                  <div>
                    <Label className="text-sm font-semibold">Name *</Label>
                    <Input
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      placeholder={farmerFieldsLocked ? "Auto-filled" : "Farmer name"}
                      className="mt-1"
                      disabled={farmerFieldsLocked}
                      readOnly={farmerFieldsLocked}
                      required
                      style={farmerFieldsLocked ? {backgroundColor: '#f5f5f5', cursor: 'not-allowed', color: '#666'} : {}}
                    />
                    {farmerFieldsLocked && (
                      <p className="text-xs text-gray-500 mt-1">🔒 Locked after verification</p>
                    )}
                  </div>
                  
                  {/* Village - Locked if farmer exists OR verified, shown only for farmers */}
                  {partyType === 'farmer' && (
                    <div>
                      <Label className="text-sm font-semibold">Village *</Label>
                      <Input
                        value={partyVillage}
                        onChange={(e) => setPartyVillage(e.target.value)}
                        placeholder={farmerFieldsLocked ? "Auto-filled" : "Village name"}
                        className="mt-1"
                        disabled={farmerFieldsLocked}
                        readOnly={farmerFieldsLocked}
                        required
                        style={farmerFieldsLocked ? {backgroundColor: '#f5f5f5', cursor: 'not-allowed', color: '#666'} : {}}
                      />
                      {farmerFieldsLocked && (
                        <p className="text-xs text-gray-500 mt-1">🔒 Locked after verification</p>
                      )}
                    </div>
                  )}
                  
                  {/* GSTIN - Only for non-farmers */}
                  {partyType !== 'farmer' && (
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
                
                {/* OTP Verification Button - Only for new farmers after filling details */}
                {partyType === 'farmer' && farmerChecked && !farmerExists && partyName && partyVillage && !otpVerified && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      onClick={handleCheckAndSendOTP}
                      disabled={otpLoading}
                      className="btn-primary"
                    >
                      {otpLoading ? '⏳ Sending...' : '📱 Verify Mobile & Register Farmer'}
                    </Button>
                    <p className="text-xs text-gray-600 mt-2">
                      ⚠️ Please verify mobile to register this farmer in master data
                    </p>
                  </div>
                )}
                
                {/* Success Message - Farmer registered */}
                {partyType === 'farmer' && otpVerified && farmerExists && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      ✅ <strong>{partyName}</strong> is registered. You can proceed with the pre-entry.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Item Section - Hidden for Sale transaction type (has its own Item & Marka section) */}
        {transactionType !== 'sale' && (
          <div className="border-t pt-4">
            <h4 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Item Details</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-semibold">Item *</Label>
                <select
                  value={itemId}
                  onChange={(e) => {
                    const selectedItemId = e.target.value;
                    setItemId(selectedItemId);
                    
                    // Auto-fill rate from item master for Farmer Purchase and Bill Purchase
                    if ((transactionType === 'farmer_purchase' || transactionType === 'bill_purchase') && selectedItemId) {
                      const selectedItem = items.find(item => item.id === selectedItemId);
                      if (selectedItem && selectedItem.rate) {
                        setRatePerQtl(selectedItem.rate);
                        console.log('[Pre-Entry] Auto-filled rate:', selectedItem.rate, 'for item:', selectedItem.name);
                      }
                    }
                  }}
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
              {(transactionType === 'farmer_purchase' || transactionType === 'bill_purchase') && (
                <div>
                  <Label className="text-sm font-semibold">Rate per Qtl *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ratePerQtl}
                    onChange={(e) => setRatePerQtl(e.target.value)}
                    placeholder="₹ per quintal"
                    className="mt-1"
                    required
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction-Specific Fields */}
        {(transactionType === 'bill_purchase' || transactionType === 'internal_transfer' || transactionType === 'custody_deposit') && (
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
              <DialogDescription>
                Fill in the details to create a new pre-entry for weighbridge processing
              </DialogDescription>
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
              <DialogDescription className="text-center">
                Scan the QR code below for quick access
              </DialogDescription>
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
              <DialogDescription>
                Multiple farmers found with similar names. Please select the correct one.
              </DialogDescription>
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
              <DialogDescription className="text-center">
                Enter the OTP sent to verify the mobile number
              </DialogDescription>
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
