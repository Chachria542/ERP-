import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import BrokerAutocomplete from '../components/BrokerAutocomplete';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BILL_TYPES = [
  { value: 'entry', label: 'Entry' },
  { value: 'purchase', label: 'Purchase' }
];

const CLAIM_TYPES = [
  { value: 'flat', label: 'Flat Amount' },
  { value: 'percentage', label: 'Percentage' }
];

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

function BillPurchasePage({ user, onLogout }) {
  const [queue, setQueue] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  
  // Photo approval modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPreEntry, setSelectedPreEntry] = useState(null);
  const [weighbridgeData, setWeighbridgeData] = useState(null);
  
  // Bill form modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [billData, setBillData] = useState({
    // Section 1: Bill Details
    bill_date: new Date().toISOString().split('T')[0],
    bill_type: 'purchase',
    
    // Section 2: Broker Details (editable)
    has_broker: false,
    broker_id: '',
    broker_name: '',
    brokerage_type: 'per_quintal',
    brokerage_rate: '',
    
    // Section 3: Line Items
    line_items: [],
    
    // Section 4: Adjustments
    batav_percentage: '',
    claim_type: 'flat',
    claim_rate: '',
    
    remarks: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQueue();
    fetchItems();
  }, [statusFilter]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await axios.get(`${API}/bill-purchase/queue?${params}`);
      setQueue(response.data);
    } catch (error) {
      console.error('Error fetching queue:', error);
      toast.error('Failed to load bill purchase queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API}/items`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
    }
  };

  const handleSearch = () => {
    fetchQueue();
  };

  const handleProcessPreEntry = async (preEntryNumber) => {
    try {
      const response = await axios.get(`${API}/bill-purchase/pre-entry/by-number/${preEntryNumber}`);
      
      if (response.data.weighbridge_entry) {
        setSelectedPreEntry(response.data.pre_entry);
        setWeighbridgeData(response.data.combined_data);
        setShowPhotoModal(true);
      } else {
        toast.error('Weighbridge entry not completed yet');
      }
    } catch (error) {
      console.error('Error fetching pre-entry details:', error);
      if (error.response?.status === 404) {
        toast.error('Pre-entry not found');
      } else {
        toast.error('Failed to load pre-entry details');
      }
    }
  };

  // Helper function to calculate bags and remaining kg
  const calculateBagsAndRemaining = (totalWeightQtl, packSizeKg) => {
    const totalWeightKg = totalWeightQtl * 100;
    const bags = Math.floor(totalWeightKg / packSizeKg);
    const remainingKg = Math.round((totalWeightKg % packSizeKg) * 100) / 100;
    return { bags, remainingKg };
  };

  // Helper function to calculate tax amounts
  const calculateTaxAmounts = (amount, cgstRate, sgstRate, igstRate) => {
    const cgstAmount = cgstRate > 0 ? Math.round((amount * cgstRate / 100) * 100) / 100 : 0;
    const sgstAmount = sgstRate > 0 ? Math.round((amount * sgstRate / 100) * 100) / 100 : 0;
    const igstAmount = igstRate > 0 ? Math.round((amount * igstRate / 100) * 100) / 100 : 0;
    
    return { cgstAmount, sgstAmount, igstAmount };
  };

  const handleApprovePhotos = () => {
    setShowPhotoModal(false);
    
    // Initialize bill form with weighbridge data
    const initialLineItem = {
      item_id: selectedPreEntry?.item_id || '',
      item_name: selectedPreEntry?.item_name || '',
      quality: '',
      pack_size: 100, // Default pack size
      bags: 0, // Will be auto-calculated
      remaining_kg: 0, // Will be auto-calculated
      actual_weight: weighbridgeData?.act_qtl || 0,
      agreed_weight: weighbridgeData?.act_qtl || 0,
      rate_per_qtl: '',
      amount: 0,
      cgst_rate: '',
      sgst_rate: '',
      igst_rate: '',
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      sort_order: 1
    };
    
    // Auto-populate broker details from pre-entry (editable)
    const hasBroker = selectedPreEntry?.has_broker || false;
    const brokerName = selectedPreEntry?.broker_name || '';
    const brokerageType = selectedPreEntry?.brokerage_type || 'per_quintal';
    const brokerageRate = selectedPreEntry?.brokerage_rate || '';
    
    setBillData({
      bill_date: new Date().toISOString().split('T')[0],
      bill_type: 'purchase',
      
      // Broker details (editable)
      has_broker: hasBroker,
      broker_id: '',
      broker_name: brokerName,
      brokerage_type: brokerageType,
      brokerage_rate: brokerageRate,
      
      line_items: [initialLineItem],
      batav_percentage: '',
      claim_type: 'flat',
      claim_rate: '',
      remarks: ''
    });
    
    setShowBillModal(true);
  };

  const handleRejectPhotos = async () => {
    try {
      await axios.put(`${API}/bill-purchase/pre-entry/${selectedPreEntry.id}/cancel`, {
        reason: 'Photos rejected by admin',
        cancelled_by: user.username
      });
      
      setShowPhotoModal(false);
      setSelectedPreEntry(null);
      setWeighbridgeData(null);
      fetchQueue();
      
      toast.success('Pre-entry cancelled due to photo rejection');
    } catch (error) {
      console.error('Error rejecting photos:', error);
      toast.error('Failed to cancel pre-entry');
    }
  };

  const handleLineItemChange = (index, field, value) => {
    setBillData(prev => {
      const newLineItems = [...prev.line_items];
      const item = { ...newLineItems[index] };
      
      // Update the field
      item[field] = value;
      
      // Auto-fill item name when item is selected
      if (field === 'item_id') {
        const selectedItem = items.find(itm => itm.id === value);
        if (selectedItem) {
          item.item_name = selectedItem.name;
        }
      }
      
      // Recalculate bags and remaining kg when pack size or agreed weight changes
      if (field === 'pack_size' || field === 'agreed_weight') {
        if (item.pack_size > 0 && item.agreed_weight > 0) {
          const { bags, remainingKg } = calculateBagsAndRemaining(item.agreed_weight, item.pack_size);
          item.bags = bags;
          item.remaining_kg = remainingKg;
        }
      }
      
      // Recalculate amount when agreed weight or rate changes
      if (field === 'agreed_weight' || field === 'rate_per_qtl') {
        item.amount = Math.round(item.agreed_weight * item.rate_per_qtl * 100) / 100;
      }
      
      // Recalculate taxes when amount or tax rates change
      if (field === 'amount' || field === 'cgst_rate' || field === 'sgst_rate' || field === 'igst_rate') {
        const { cgstAmount, sgstAmount, igstAmount } = calculateTaxAmounts(
          item.amount, item.cgst_rate, item.sgst_rate, item.igst_rate
        );
        item.cgst_amount = cgstAmount;
        item.sgst_amount = sgstAmount;
        item.igst_amount = igstAmount;
      }
      
      // Ensure mutual exclusion for CGST+SGST vs IGST
      if (field === 'igst_rate' && value > 0) {
        item.cgst_rate = 0;
        item.sgst_rate = 0;
        item.cgst_amount = 0;
        item.sgst_amount = 0;
      } else if ((field === 'cgst_rate' || field === 'sgst_rate') && value > 0) {
        item.igst_rate = 0;
        item.igst_amount = 0;
      }
      
      newLineItems[index] = item;
      
      return {
        ...prev,
        line_items: newLineItems
      };
    });
  };

  const calculateBrokerageAmount = () => {
    if (!billData.has_broker || !billData.brokerage_rate || billData.brokerage_rate <= 0) {
      return 0;
    }
    
    const rate = parseFloat(billData.brokerage_rate) || 0;
    const totalBags = billData.line_items.reduce((sum, item) => sum + (item.bags || 0), 0);
    const totalQtls = billData.line_items.reduce((sum, item) => sum + (parseFloat(item.agreed_weight) || 0), 0);
    const lineItemsTotal = billData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    switch (billData.brokerage_type) {
      case 'per_quintal':
        return Math.round(rate * totalQtls * 100) / 100;
      case 'per_bag':
        return Math.round(rate * totalBags * 100) / 100;
      case 'percentage':
        return Math.round((lineItemsTotal * rate / 100) * 100) / 100;
      case 'none':
      default:
        return 0;
    }
  };

  const calculateTotals = () => {
    const lineItemsTotal = billData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalTaxAmount = billData.line_items.reduce((sum, item) => 
      sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
    const grossAmount = lineItemsTotal + totalTaxAmount;
    
    // Calculate batav (cash discount)
    const batavAmount = Math.round((grossAmount * (parseFloat(billData.batav_percentage) || 0) / 100) * 100) / 100;
    
    // Calculate claim amount
    const claimAmount = billData.claim_type === 'percentage' 
      ? Math.round((grossAmount * (parseFloat(billData.claim_rate) || 0) / 100) * 100) / 100
      : (parseFloat(billData.claim_rate) || 0);
    
    const totalDeductions = batavAmount + claimAmount;
    const netAmount = grossAmount - totalDeductions;
    
    return { 
      lineItemsTotal, 
      totalTaxAmount, 
      grossAmount, 
      batavAmount, 
      claimAmount, 
      totalDeductions, 
      netAmount 
    };
  };

  const handleCreateBill = async (saveAsDraft = false) => {
    try {
      if (billData.line_items.length === 0) {
        toast.error('At least one line item is required');
        return;
      }
      
      if (billData.line_items.some(item => !item.item_id || !item.rate_per_qtl || !item.agreed_weight)) {
        toast.error('All line items must have item, rate, and agreed weight filled');
        return;
      }
      
      setSubmitting(true);
      
      const submitData = {
        ...billData,
        pre_entry_id: selectedPreEntry.id,
        created_by: user.username
      };
      
      const response = await axios.post(`${API}/bill-purchase`, submitData);
      
      if (!saveAsDraft) {
        // Post the bill immediately if not saving as draft
        await axios.post(`${API}/bill-purchase/${response.data.id}/post`, {
          user_id: user.username
        });
      }
      
      setShowBillModal(false);
      setSelectedPreEntry(null);
      setWeighbridgeData(null);
      fetchQueue();
      
      toast.success(`Bill ${saveAsDraft ? 'saved as draft' : 'created and posted'} successfully!`);
      
    } catch (error) {
      console.error('Error creating bill:', error);
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to create bill');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'weigh_pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Weigh Pending' },
      'pending': { color: 'bg-blue-100 text-blue-800', label: 'Pending' },
      'bill_generated': { color: 'bg-green-100 text-green-800', label: 'Bill Generated' },
      'cancelled': { color: 'bg-red-100 text-red-800', label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const { lineItemsTotal, totalTaxAmount, grossAmount, batavAmount, claimAmount, totalDeductions, netAmount } = calculateTotals();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Bill Purchase</h1>
          <p className="text-gray-600 mt-1">Process bill purchases after photo approval</p>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Pre-Entry</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Pre-entry number, supplier name, or E-Way bill..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>Search</Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="status">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="weigh_pending">Weigh Pending</SelectItem>
                  <SelectItem value="bill_generated">Bill Generated</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Queue Table */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Bill Purchase Queue</h2>
            
            {loading ? (
              <div className="text-center py-8">Loading queue...</div>
            ) : queue.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pre-entries found for the selected status
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Pre-Entry No.</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Item</th>
                      <th className="text-left p-3">E-Way Bill</th>
                      <th className="text-left p-3">Expected Qty</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.pre_entry_id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-sm">{item.pre_entry_number}</td>
                        <td className="p-3">{item.date}</td>
                        <td className="p-3">{item.supplier_name}</td>
                        <td className="p-3 text-sm">-</td>
                        <td className="p-3 text-sm">{item.eway_bill_no || '-'}</td>
                        <td className="p-3 text-sm">{item.expected_quantity || '-'}</td>
                        <td className="p-3">{getStatusBadge(item.status)}</td>
                        <td className="p-3">
                          {item.status === 'pending' ? (
                            <Button
                              size="sm"
                              onClick={() => handleProcessPreEntry(item.pre_entry_number)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Process
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* Photo Approval Modal */}
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Photo Approval - {selectedPreEntry?.pre_entry_number}</DialogTitle>
            </DialogHeader>
            
            {weighbridgeData && (
              <div className="space-y-6">
                {/* Pre-Entry Details */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p><strong>Supplier:</strong> {weighbridgeData.supplier_name}</p>
                    <p><strong>GSTIN:</strong> {weighbridgeData.supplier_gstin || 'N/A'}</p>
                    <p><strong>Place of Supply:</strong> {weighbridgeData.place_of_supply}</p>
                  </div>
                  <div>
                    <p><strong>Vehicle:</strong> {weighbridgeData.vehicle_number}</p>
                    <p><strong>E-Way Bill:</strong> {weighbridgeData.eway_bill_no || 'N/A'}</p>
                    <p><strong>Net Weight:</strong> {weighbridgeData.net_weight} kg</p>
                  </div>
                </div>

                {/* Weight Details */}
                <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="text-center">
                    <p className="font-semibold text-lg">{weighbridgeData.gross_weight} kg</p>
                    <p className="text-gray-600">Gross Weight</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg">{weighbridgeData.tare_weight} kg</p>
                    <p className="text-gray-600">Tare Weight</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg text-green-600">{weighbridgeData.net_weight} kg</p>
                    <p className="text-gray-600">Net Weight</p>
                  </div>
                </div>

                {/* Photos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Gross Weight Photo</h3>
                    <div className="bg-gray-100 h-48 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Photo: {weighbridgeData.photo_gross_url}</p>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Tare Weight Photo</h3>
                    <div className="bg-gray-100 h-48 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Photo: {weighbridgeData.photo_tare_url}</p>
                    </div>
                  </div>
                </div>

                {/* Approval Buttons */}
                <div className="flex justify-end space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={handleRejectPhotos}
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    Reject Photos
                  </Button>
                  <Button 
                    onClick={handleApprovePhotos}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve & Continue
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Comprehensive Bill Creation Modal */}
        <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
          <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create Bill - {selectedPreEntry?.pre_entry_number}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8">
              {/* Section 1: Bill Details */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Section 1: Bill Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="bill_date">Bill Date</Label>
                    <Input
                      id="bill_date"
                      type="date"
                      value={billData.bill_date}
                      onChange={(e) => setBillData(prev => ({ ...prev, bill_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bill_number">Bill Number</Label>
                    <Input
                      id="bill_number"
                      value="Auto-generated"
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bill_type">Type</Label>
                    <Select 
                      value={billData.bill_type} 
                      onValueChange={(value) => setBillData(prev => ({ ...prev, bill_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="vehicle_number">Vehicle Number</Label>
                    <Input
                      id="vehicle_number"
                      value={weighbridgeData?.vehicle_number || ''}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>
              </Card>

              {/* Section 2: Supplier & Broker Details */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Section 2: Supplier & Broker Details</h3>
                
                {/* Supplier Info (Read-only) */}
                <div className="mb-4">
                  <Label className="text-sm font-semibold text-gray-700">Supplier Information</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                    <div>
                      <Label className="text-xs">Supplier Name</Label>
                      <Input value={selectedPreEntry?.supplier_name || ''} disabled className="bg-gray-100 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">GSTIN</Label>
                      <Input value={selectedPreEntry?.supplier_gstin || 'N/A'} disabled className="bg-gray-100 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Place of Supply</Label>
                      <Input value={selectedPreEntry?.place_of_supply || ''} disabled className="bg-gray-100 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Broker Details (Editable) */}
                <div className="border-t pt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="checkbox"
                      id="has_broker"
                      checked={billData.has_broker}
                      onChange={(e) => setBillData({...billData, has_broker: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="has_broker" className="text-sm font-semibold cursor-pointer">
                      Has Broker
                    </Label>
                  </div>

                  {billData.has_broker && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Broker Name *</Label>
                        <BrokerAutocomplete
                          value={billData.broker_name}
                          onSelect={(broker) => {
                            console.log('Broker selected:', broker);
                            setBillData({
                              ...billData,
                              broker_name: broker.name,
                              broker_id: broker.id || '',
                              brokerage_type: broker.default_brokerage_type || billData.brokerage_type,
                              brokerage_rate: broker.default_brokerage_rate || billData.brokerage_rate
                            });
                          }}
                          placeholder="Type broker name..."
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Brokerage Type *</Label>
                        <Select
                          value={billData.brokerage_type}
                          onValueChange={(value) => setBillData({...billData, brokerage_type: value})}
                        >
                          <SelectTrigger>
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

                      <div>
                        <Label>Brokerage Rate *</Label>
                        <Input
                          type="number"
                          className="no-spinner"
                          value={billData.brokerage_rate}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setBillData({...billData, brokerage_rate: value});
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <Label>Brokerage Amount</Label>
                        <Input
                          value={`₹${calculateBrokerageAmount().toFixed(2)}`}
                          disabled
                          className="bg-gray-100 font-semibold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Section 3: Line Items with Auto Calculations */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Section 3: Line Items</h3>
                
                {billData.line_items.map((item, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg mb-4">
                    <h4 className="font-semibold">Item #{index + 1}</h4>
                    
                    {/* Row 1: Basic Item Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Item Name</Label>
                        <Select 
                          value={item.item_id} 
                          onValueChange={(value) => handleLineItemChange(index, 'item_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((itm) => (
                              <SelectItem key={itm.id} value={itm.id}>
                                {itm.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quality</Label>
                        <Input
                          value={item.quality}
                          onChange={(e) => handleLineItemChange(index, 'quality', e.target.value)}
                          placeholder="Quality type"
                        />
                      </div>
                      <div>
                        <Label>Pack Size (kg)</Label>
                        <Input
                          type="number"
                          value={item.pack_size}
                          onChange={(e) => handleLineItemChange(index, 'pack_size', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Row 2: Weight Calculations */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <Label>Bags (Auto)</Label>
                        <Input
                          value={item.bags}
                          disabled
                          className="bg-gray-100"
                        />
                      </div>
                      <div>
                        <Label>Remaining Kg (Auto)</Label>
                        <Input
                          value={item.remaining_kg}
                          disabled
                          className="bg-gray-100"
                        />
                      </div>
                      <div>
                        <Label>Actual Weight (Qtls)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.actual_weight}
                          disabled
                          className="bg-gray-100"
                        />
                      </div>
                      <div>
                        <Label>Agreed Weight (Qtls)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.agreed_weight}
                          onChange={(e) => handleLineItemChange(index, 'agreed_weight', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Rate per Qtl</Label>
                        <Input
                          type="number"
                          className="no-spinner"
                          value={item.rate_per_qtl}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              handleLineItemChange(index, 'rate_per_qtl', value === '' ? '' : parseFloat(value) || 0);
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Row 3: Amount and Taxes */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div>
                        <Label>Amount (Auto)</Label>
                        <Input
                          value={`₹${item.amount.toFixed(2)}`}
                          disabled
                          className="bg-gray-100 font-semibold"
                        />
                      </div>
                      <div>
                        <Label>CGST %</Label>
                        <Input
                          type="number"
                          className="no-spinner"
                          value={item.cgst_rate}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              handleLineItemChange(index, 'cgst_rate', value === '' ? '' : parseFloat(value) || 0);
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>SGST %</Label>
                        <Input
                          type="number"
                          className="no-spinner"
                          value={item.sgst_rate}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              handleLineItemChange(index, 'sgst_rate', value === '' ? '' : parseFloat(value) || 0);
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>IGST %</Label>
                        <Input
                          type="number"
                          className="no-spinner"
                          value={item.igst_rate}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              handleLineItemChange(index, 'igst_rate', value === '' ? '' : parseFloat(value) || 0);
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Tax Amount (Auto)</Label>
                        <Input
                          value={`₹${(item.cgst_amount + item.sgst_amount + item.igst_amount).toFixed(2)}`}
                          disabled
                          className="bg-gray-100 font-semibold"
                        />
                      </div>
                      <div>
                        <Label>Line Total (Auto)</Label>
                        <Input
                          value={`₹${(item.amount + item.cgst_amount + item.sgst_amount + item.igst_amount).toFixed(2)}`}
                          disabled
                          className="bg-green-100 font-bold text-green-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </Card>

              {/* Section 4: Adjustments */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Section 4: Adjustments</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Batav (Cash Discount %)</Label>
                    <Input
                      type="number"
                      className="no-spinner"
                      value={billData.batav_percentage}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setBillData(prev => ({ ...prev, batav_percentage: value }));
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Batav Amount (Auto)</Label>
                    <Input
                      value={`₹${batavAmount.toFixed(2)}`}
                      disabled
                      className="bg-gray-100 font-semibold"
                    />
                  </div>
                  <div>
                    <Label>Claim Type</Label>
                    <Select 
                      value={billData.claim_type} 
                      onValueChange={(value) => setBillData(prev => ({ ...prev, claim_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLAIM_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Claim Rate {billData.claim_type === 'percentage' ? '(%)' : '(₹)'}</Label>
                    <Input
                      type="number"
                      className="no-spinner"
                      value={billData.claim_rate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setBillData(prev => ({ ...prev, claim_rate: value }));
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label>Claim Amount (Auto)</Label>
                  <Input
                    value={`₹${claimAmount.toFixed(2)}`}
                    disabled
                    className="bg-gray-100 font-semibold w-48"
                  />
                </div>
              </Card>

              {/* Totals Summary */}
              <Card className="p-6 bg-blue-50">
                <h3 className="text-xl font-semibold mb-4">Bill Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Line Items Total</p>
                    <p className="text-lg font-semibold">₹{lineItemsTotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Tax</p>
                    <p className="text-lg font-semibold">₹{totalTaxAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gross Amount</p>
                    <p className="text-lg font-semibold">₹{grossAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Deductions</p>
                    <p className="text-lg font-semibold text-red-600">-₹{totalDeductions.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 text-center border-t pt-4">
                  <p className="text-sm text-gray-600">Net Amount</p>
                  <p className="text-3xl font-bold text-green-600">₹{netAmount.toFixed(2)}</p>
                </div>
              </Card>

              {/* Remarks */}
              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={billData.remarks}
                  onChange={(e) => setBillData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBillModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleCreateBill(true)}
                  disabled={submitting}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {submitting ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button 
                  onClick={() => handleCreateBill(false)}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : 'Create & Post Bill'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default BillPurchasePage;