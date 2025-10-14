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
    
    // Section 3: Line Items
    line_items: [],
    
    // Section 4: Adjustments
    batav_percentage: 0,
    claim_type: 'flat',
    claim_rate: 0,
    
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
      rate_per_qtl: 0,
      amount: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      sort_order: 1
    };
    
    setBillData({
      bill_date: new Date().toISOString().split('T')[0],
      bill_type: 'purchase',
      line_items: [initialLineItem],
      batav_percentage: 0,
      claim_type: 'flat',
      claim_rate: 0,
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

  const addLineItem = () => {
    setBillData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          item_id: '',
          item_name: '',
          quality: '',
          pack_size: 100,
          bags: 0,
          remaining_kg: 0,
          actual_weight: 0,
          agreed_weight: 0,
          rate_per_qtl: 0,
          amount: 0,
          cgst_rate: 0,
          sgst_rate: 0,
          igst_rate: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          sort_order: prev.line_items.length + 1
        }
      ]
    }));
  };

  const removeLineItem = (index) => {
    setBillData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotals = () => {
    const subtotal = billData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalCharges = billData.freight + billData.hamali_tulai + billData.aadat + 
                        billData.mandi_cess + billData.bank_charges;
    const grandTotal = subtotal + totalCharges + billData.rounding;
    
    return { subtotal, totalCharges, grandTotal };
  };

  const handleCreateBill = async () => {
    try {
      if (billData.line_items.length === 0) {
        toast.error('At least one line item is required');
        return;
      }
      
      if (billData.line_items.some(item => !item.item_id || !item.rate_per_qtl)) {
        toast.error('All line items must have item and rate selected');
        return;
      }
      
      setSubmitting(true);
      
      const submitData = {
        ...billData,
        pre_entry_id: selectedPreEntry.id,
        created_by: user.username
      };
      
      const response = await axios.post(`${API}/bill-purchase`, submitData);
      
      setShowBillModal(false);
      setSelectedPreEntry(null);
      setWeighbridgeData(null);
      fetchQueue();
      
      toast.success('Bill created successfully!');
      
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

  const { subtotal, totalCharges, grandTotal } = calculateTotals();

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
                      <th className="text-left p-3">GSTIN</th>
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
                        <td className="p-3 text-sm">{item.supplier_gstin || '-'}</td>
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

        {/* Bill Creation Modal */}
        <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Bill - {selectedPreEntry?.pre_entry_number}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Supplier Info (Read-only) */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p><strong>Supplier:</strong> {selectedPreEntry?.supplier_name}</p>
                  <p><strong>GSTIN:</strong> {selectedPreEntry?.supplier_gstin || 'N/A'}</p>
                </div>
                <div>
                  <p><strong>Place of Supply:</strong> {selectedPreEntry?.place_of_supply}</p>
                  <p><strong>Net Weight:</strong> {weighbridgeData?.net_weight} kg</p>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier_invoice_no">Supplier Invoice No.</Label>
                  <Input
                    id="supplier_invoice_no"
                    value={billData.supplier_invoice_no}
                    onChange={(e) => setBillData(prev => ({ ...prev, supplier_invoice_no: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_invoice_date">Supplier Invoice Date</Label>
                  <Input
                    id="supplier_invoice_date"
                    type="date"
                    value={billData.supplier_invoice_date}
                    onChange={(e) => setBillData(prev => ({ ...prev, supplier_invoice_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Line Items</h3>
                  <Button onClick={addLineItem} size="sm">+ Add Item</Button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border p-2 text-left">Item</th>
                        <th className="border p-2 text-left">Bags</th>
                        <th className="border p-2 text-left">Kgs</th>
                        <th className="border p-2 text-left">Rate/Qtl</th>
                        <th className="border p-2 text-left">Amount</th>
                        <th className="border p-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billData.line_items.map((item, index) => (
                        <tr key={index}>
                          <td className="border p-2">
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
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              value={item.bags}
                              onChange={(e) => handleLineItemChange(index, 'bags', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.kgs}
                              onChange={(e) => handleLineItemChange(index, 'kgs', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.rate_per_qtl}
                              onChange={(e) => handleLineItemChange(index, 'rate_per_qtl', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="border p-2">
                            <span className="font-semibold">₹{item.amount.toFixed(2)}</span>
                          </td>
                          <td className="border p-2">
                            {billData.line_items.length > 1 && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => removeLineItem(index)}
                              >
                                Remove
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Charges */}
              <div>
                <h3 className="font-semibold mb-4">Additional Charges</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="freight">Freight</Label>
                    <Input
                      id="freight"
                      type="number"
                      step="0.01"
                      value={billData.freight}
                      onChange={(e) => setBillData(prev => ({ ...prev, freight: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hamali_tulai">Hamali/Tulai</Label>
                    <Input
                      id="hamali_tulai"
                      type="number"
                      step="0.01"
                      value={billData.hamali_tulai}
                      onChange={(e) => setBillData(prev => ({ ...prev, hamali_tulai: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="aadat">Aadat</Label>
                    <Input
                      id="aadat"
                      type="number"
                      step="0.01"
                      value={billData.aadat}
                      onChange={(e) => setBillData(prev => ({ ...prev, aadat: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mandi_cess">Mandi Cess</Label>
                    <Input
                      id="mandi_cess"
                      type="number"
                      step="0.01"
                      value={billData.mandi_cess}
                      onChange={(e) => setBillData(prev => ({ ...prev, mandi_cess: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank_charges">Bank Charges</Label>
                    <Input
                      id="bank_charges"
                      type="number"
                      step="0.01"
                      value={billData.bank_charges}
                      onChange={(e) => setBillData(prev => ({ ...prev, bank_charges: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rounding">Rounding</Label>
                    <Input
                      id="rounding"
                      type="number"
                      step="0.01"
                      value={billData.rounding}
                      onChange={(e) => setBillData(prev => ({ ...prev, rounding: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-4 text-right">
                  <div></div>
                  <div>
                    <p>Subtotal: <span className="font-semibold">₹{subtotal.toFixed(2)}</span></p>
                    <p>Total Charges: <span className="font-semibold">₹{totalCharges.toFixed(2)}</span></p>
                    <p className="text-lg font-bold">Grand Total: <span className="text-green-600">₹{grandTotal.toFixed(2)}</span></p>
                  </div>
                  <div></div>
                </div>
              </div>

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
              <div className="flex justify-end space-x-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBillModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateBill}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Bill'}
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