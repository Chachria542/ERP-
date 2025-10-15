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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

const PACK_SIZE_OPTIONS = [
  { value: 100, label: '100 kg' },
  { value: 50, label: '50 kg' },
  { value: 30, label: '30 kg' },
  { value: 25, label: '25 kg' }
];

function SalesInvoicePage({ user, onLogout }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  
  // Photo approval modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPreEntry, setSelectedPreEntry] = useState(null);
  const [weighbridgeData, setWeighbridgeData] = useState(null);
  
  // Invoice form modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isReturn, setIsReturn] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    weighbridge_slip_no: '',
    is_entry: false, // false = Godown (default), true = Entry
    
    // Item details
    item_id: '',
    item_name: '',
    marka: '',
    bharti: 50,
    bags: 0,
    kgs: 0,
    actual_qtl: 0,
    rate: '',
    amount: 0,
    
    // Taxes (CGST + SGST only, no IGST)
    cgst_rate: '',
    cgst_amount: 0,
    sgst_rate: '',
    sgst_amount: 0,
    
    // Additional charges
    freight: '',
    loading_charges: '',
    other_charges: '',
    
    // TCS (applied before GST)
    tcs_applicable: false,
    tcs_rate: '',
    tcs_amount: 0,
    
    // Rounding
    round_off: 0,
    subtotal: 0,
    tax_total: 0,
    grand_total: 0,
    
    // Broker (always shown)
    broker_name: '',
    brokerage_type: 'per_quintal',
    brokerage_rate: '',
    
    remarks: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQueue();
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
      
      const response = await axios.get(`${API}/sales/queue?${params}`);
      setQueue(response.data);
    } catch (error) {
      console.error('Error fetching sales queue:', error);
      toast.error('Failed to load sales queue');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPhotos = async (preEntry) => {
    try {
      // Fetch weighbridge entry for this pre-entry
      const response = await axios.get(`${API}/weighbridge-entry/by-slip/${preEntry.pre_entry_number}`);
      setWeighbridgeData(response.data);
      setSelectedPreEntry(preEntry);
      setShowPhotoModal(true);
    } catch (error) {
      console.error('Error fetching weighbridge data:', error);
      toast.error('Failed to load weighbridge data');
    }
  };

  const handleApprovePhotos = () => {
    setShowPhotoModal(false);
    handleCreateInvoice(selectedPreEntry);
  };

  const handleCreateInvoice = (preEntry) => {
    setSelectedPreEntry(preEntry);
    
    // Pre-fill invoice data from pre-entry
    setInvoiceData({
      ...invoiceData,
      invoice_date: new Date().toISOString().split('T')[0],
      item_id: preEntry.item_id,
      item_name: preEntry.item_name,
      marka: preEntry.marka || '',
      bharti: preEntry.bharti || 50,
      bags: Math.floor(preEntry.net_weight / (preEntry.bharti || 50)),
      kgs: preEntry.net_weight % (preEntry.bharti || 50),
      actual_qtl: (preEntry.net_weight / 100).toFixed(2),
      has_broker: preEntry.has_broker,
      broker_name: preEntry.broker_name || '',
      brokerage_type: preEntry.brokerage_type || 'per_quintal',
      brokerage_rate: preEntry.brokerage_rate || ''
    });
    
    setShowInvoiceModal(true);
  };

  const calculateTotals = () => {
    const bags = parseFloat(invoiceData.bags) || 0;
    const kgs = parseFloat(invoiceData.kgs) || 0;
    const bharti = parseFloat(invoiceData.bharti) || 50;
    const rate = parseFloat(invoiceData.rate) || 0;
    
    // Calculate actual quintals
    const actualQtl = ((bags * bharti) + kgs) / 100;
    
    // Calculate amount
    const amount = actualQtl * rate;
    
    // Calculate taxes
    const cgstAmount = invoiceData.cgst_rate ? (amount * parseFloat(invoiceData.cgst_rate)) / 100 : 0;
    const sgstAmount = invoiceData.sgst_rate ? (amount * parseFloat(invoiceData.sgst_rate)) / 100 : 0;
    const igstAmount = invoiceData.igst_rate ? (amount * parseFloat(invoiceData.igst_rate)) / 100 : 0;
    const taxTotal = cgstAmount + sgstAmount + igstAmount;
    
    // Calculate additional charges
    const freight = parseFloat(invoiceData.freight) || 0;
    const loadingCharges = parseFloat(invoiceData.loading_charges) || 0;
    const otherCharges = parseFloat(invoiceData.other_charges) || 0;
    
    // Calculate subtotal before TCS
    const subtotal = amount + taxTotal + freight + loadingCharges + otherCharges;
    
    // Calculate TCS
    const tcsAmount = invoiceData.tcs_applicable && invoiceData.tcs_rate 
      ? (subtotal * parseFloat(invoiceData.tcs_rate)) / 100 
      : 0;
    
    // Calculate grand total before rounding
    const beforeRounding = subtotal + tcsAmount;
    
    // Apply rounding to nearest rupee
    const roundOff = Math.round(beforeRounding) - beforeRounding;
    const grandTotal = Math.round(beforeRounding);
    
    return {
      actual_qtl: actualQtl.toFixed(2),
      amount: amount.toFixed(2),
      cgst_amount: cgstAmount.toFixed(2),
      sgst_amount: sgstAmount.toFixed(2),
      igst_amount: igstAmount.toFixed(2),
      tax_total: taxTotal.toFixed(2),
      tcs_amount: tcsAmount.toFixed(2),
      round_off: roundOff.toFixed(2),
      subtotal: subtotal.toFixed(2),
      grand_total: grandTotal.toFixed(2)
    };
  };

  // Auto-calculate when relevant fields change
  useEffect(() => {
    if (showInvoiceModal) {
      const calculated = calculateTotals();
      setInvoiceData(prev => ({
        ...prev,
        ...calculated
      }));
    }
  }, [
    invoiceData.bags,
    invoiceData.kgs,
    invoiceData.bharti,
    invoiceData.rate,
    invoiceData.cgst_rate,
    invoiceData.sgst_rate,
    invoiceData.igst_rate,
    invoiceData.freight,
    invoiceData.loading_charges,
    invoiceData.other_charges,
    invoiceData.tcs_applicable,
    invoiceData.tcs_rate
  ]);

  const handleSubmitInvoice = async () => {
    try {
      setSubmitting(true);
      
      // Validation
      if (!invoiceData.customer_invoice_no) {
        toast.error('Customer Invoice Number is required');
        return;
      }
      
      if (!invoiceData.rate) {
        toast.error('Rate per quintal is required');
        return;
      }
      
      const payload = {
        pre_entry_id: selectedPreEntry.id,
        sale_type: isReturn ? 'sales_return' : 'normal_sale',
        invoice_date: invoiceData.invoice_date,
        customer_invoice_no: invoiceData.customer_invoice_no,
        customer_invoice_date: invoiceData.customer_invoice_date,
        
        line_items: [{
          item_id: invoiceData.item_id,
          item_name: invoiceData.item_name,
          marka: invoiceData.marka,
          bags: parseInt(invoiceData.bags),
          kgs: parseFloat(invoiceData.kgs),
          bharti: parseInt(invoiceData.bharti),
          actual_qtl: parseFloat(invoiceData.actual_qtl),
          rate: parseFloat(invoiceData.rate),
          amount: parseFloat(invoiceData.amount)
        }],
        
        cgst_rate: invoiceData.cgst_rate ? parseFloat(invoiceData.cgst_rate) : null,
        cgst_amount: parseFloat(invoiceData.cgst_amount),
        sgst_rate: invoiceData.sgst_rate ? parseFloat(invoiceData.sgst_rate) : null,
        sgst_amount: parseFloat(invoiceData.sgst_amount),
        igst_rate: invoiceData.igst_rate ? parseFloat(invoiceData.igst_rate) : null,
        igst_amount: parseFloat(invoiceData.igst_amount),
        
        freight: invoiceData.freight ? parseFloat(invoiceData.freight) : null,
        loading_charges: invoiceData.loading_charges ? parseFloat(invoiceData.loading_charges) : null,
        other_charges: invoiceData.other_charges ? parseFloat(invoiceData.other_charges) : null,
        
        tcs_applicable: invoiceData.tcs_applicable,
        tcs_rate: invoiceData.tcs_rate ? parseFloat(invoiceData.tcs_rate) : null,
        tcs_amount: parseFloat(invoiceData.tcs_amount),
        
        round_off: parseFloat(invoiceData.round_off),
        grand_total: parseFloat(invoiceData.grand_total),
        
        has_broker: invoiceData.has_broker,
        broker_name: invoiceData.broker_name || null,
        brokerage_type: invoiceData.brokerage_type,
        brokerage_rate: invoiceData.brokerage_rate ? parseFloat(invoiceData.brokerage_rate) : null,
        
        remarks: invoiceData.remarks || null,
        created_by: user.username
      };
      
      const response = await axios.post(`${API}/sales/invoice`, payload);
      
      toast.success(`${isReturn ? 'Sales Return' : 'Sales Invoice'} created: ${response.data.invoice_number}`);
      
      setShowInvoiceModal(false);
      fetchQueue();
      resetInvoiceForm();
      
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceData({
      invoice_date: new Date().toISOString().split('T')[0],
      customer_invoice_no: '',
      customer_invoice_date: new Date().toISOString().split('T')[0],
      item_id: '',
      item_name: '',
      marka: '',
      bharti: 50,
      bags: 0,
      kgs: 0,
      actual_qtl: 0,
      rate: '',
      amount: 0,
      cgst_rate: '',
      cgst_amount: 0,
      sgst_rate: '',
      sgst_amount: 0,
      igst_rate: '',
      igst_amount: 0,
      freight: '',
      loading_charges: '',
      other_charges: '',
      tcs_applicable: false,
      tcs_rate: '',
      tcs_amount: 0,
      round_off: 0,
      subtotal: 0,
      tax_total: 0,
      grand_total: 0,
      has_broker: false,
      broker_name: '',
      brokerage_type: 'per_quintal',
      brokerage_rate: '',
      remarks: ''
    });
    setIsReturn(false);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      invoice_generated: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Sales Invoice</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Process sales invoices and returns</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-semibold">Search</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by pre-entry number or customer..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="invoice_generated">Invoice Generated</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchQueue} className="btn-primary">
                🔄 Refresh Queue
              </Button>
            </div>
          </div>
        </Card>

        {/* Queue Table */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Sales Queue</h2>
          
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No sales pre-entries found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Pre-Entry No.</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Marka</th>
                    <th className="text-right p-3">Net Weight (kg)</th>
                    <th className="text-right p-3">Quintals</th>
                    <th className="text-left p-3">Broker</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-center p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.pre_entry_number}</td>
                      <td className="p-3">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="p-3">{item.customer_name}</td>
                      <td className="p-3">{item.item_name}</td>
                      <td className="p-3">{item.marka || '-'}</td>
                      <td className="p-3 text-right">{item.net_weight?.toFixed(2) || '-'}</td>
                      <td className="p-3 text-right">{item.net_weight ? (item.net_weight / 100).toFixed(2) : '-'}</td>
                      <td className="p-3">{item.broker_name || '-'}</td>
                      <td className="p-3">{getStatusBadge(item.status)}</td>
                      <td className="p-3 text-center">
                        {item.status === 'pending' && (
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              onClick={() => handleViewPhotos(item)}
                              className="btn-secondary"
                            >
                              📷 Photos
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleCreateInvoice(item)}
                              className="btn-primary"
                            >
                              📄 Invoice
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Photo Approval Modal */}
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Photo Approval - {selectedPreEntry?.pre_entry_number}</DialogTitle>
            </DialogHeader>
            
            {weighbridgeData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold mb-2">TARE Photo (Empty Truck)</h3>
                    {weighbridgeData.photo_tare_url ? (
                      <img src={weighbridgeData.photo_tare_url} alt="Tare" className="w-full rounded border" />
                    ) : (
                      <div className="bg-gray-100 p-8 text-center rounded">No photo available</div>
                    )}
                    <p className="text-sm mt-2">Weight: {weighbridgeData.tare_weight} kg</p>
                  </div>
                  
                  <div>
                    <h3 className="font-bold mb-2">GROSS Photo (Loaded Truck)</h3>
                    {weighbridgeData.photo_gross_url ? (
                      <img src={weighbridgeData.photo_gross_url} alt="Gross" className="w-full rounded border" />
                    ) : (
                      <div className="bg-gray-100 p-8 text-center rounded">No photo available</div>
                    )}
                    <p className="text-sm mt-2">Weight: {weighbridgeData.gross_weight} kg</p>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded">
                  <h3 className="font-bold mb-2">Net Weight</h3>
                  <p className="text-2xl font-bold text-green-600">{weighbridgeData.net_weight} kg</p>
                  <p className="text-sm text-gray-600">({(weighbridgeData.net_weight / 100).toFixed(2)} quintals)</p>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPhotoModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleApprovePhotos} className="btn-primary">
                    ✅ Approve & Create Invoice
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Invoice Form Modal - Will be implemented in next phase */}
        <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isReturn ? '🔄 Sales Return' : '📄 Sales Invoice'} - {selectedPreEntry?.pre_entry_number}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Return Toggle */}
              <div className="flex items-center space-x-2 bg-blue-50 p-4 rounded">
                <Checkbox
                  id="isReturn"
                  checked={isReturn}
                  onCheckedChange={setIsReturn}
                />
                <Label htmlFor="isReturn" className="font-medium cursor-pointer">
                  This is a Sales Return (negative amounts)
                </Label>
              </div>

              {/* Pre-Entry Details */}
              <Card className="p-4 bg-gray-50">
                <h3 className="font-bold mb-3">Pre-Entry Details</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Customer</p>
                    <p className="font-medium">{selectedPreEntry?.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Item</p>
                    <p className="font-medium">{selectedPreEntry?.item_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Net Weight</p>
                    <p className="font-medium">{selectedPreEntry?.net_weight} kg</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Place of Supply</p>
                    <p className="font-medium">{selectedPreEntry?.place_of_supply}</p>
                  </div>
                </div>
              </Card>

              {/* Invoice Header */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Invoice Date *</Label>
                  <Input
                    type="date"
                    value={invoiceData.invoice_date}
                    onChange={(e) => setInvoiceData({...invoiceData, invoice_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Customer Invoice No. *</Label>
                  <Input
                    value={invoiceData.customer_invoice_no}
                    onChange={(e) => setInvoiceData({...invoiceData, customer_invoice_no: e.target.value})}
                    placeholder="Customer's invoice number"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Customer Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceData.customer_invoice_date}
                    onChange={(e) => setInvoiceData({...invoiceData, customer_invoice_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Item & Quantity Details */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Item & Quantity</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>Marka</Label>
                    <Input
                      value={invoiceData.marka}
                      onChange={(e) => setInvoiceData({...invoiceData, marka: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Pack Size (Bharti)</Label>
                    <Select 
                      value={invoiceData.bharti.toString()} 
                      onValueChange={(val) => setInvoiceData({...invoiceData, bharti: parseInt(val)})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PACK_SIZE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bags</Label>
                    <Input
                      type="number"
                      value={invoiceData.bags}
                      onChange={(e) => setInvoiceData({...invoiceData, bags: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Remaining Kgs</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.kgs}
                      onChange={(e) => setInvoiceData({...invoiceData, kgs: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Actual Quintals</p>
                    <p className="text-xl font-bold">{invoiceData.actual_qtl}</p>
                  </div>
                  <div>
                    <Label>Rate per Quintal (₹) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.rate}
                      onChange={(e) => setInvoiceData({...invoiceData, rate: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="text-xl font-bold">₹ {invoiceData.amount}</p>
                  </div>
                </div>
              </Card>

              {/* Taxes */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Taxes</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>CGST Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.cgst_rate}
                      onChange={(e) => setInvoiceData({...invoiceData, cgst_rate: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-600 mt-1">Amount: ₹ {invoiceData.cgst_amount}</p>
                  </div>
                  <div>
                    <Label>SGST Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.sgst_rate}
                      onChange={(e) => setInvoiceData({...invoiceData, sgst_rate: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-600 mt-1">Amount: ₹ {invoiceData.sgst_amount}</p>
                  </div>
                  <div>
                    <Label>IGST Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.igst_rate}
                      onChange={(e) => setInvoiceData({...invoiceData, igst_rate: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-600 mt-1">Amount: ₹ {invoiceData.igst_amount}</p>
                  </div>
                </div>
              </Card>

              {/* Additional Charges */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Additional Charges</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Freight (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.freight}
                      onChange={(e) => setInvoiceData({...invoiceData, freight: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Loading Charges (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.loading_charges}
                      onChange={(e) => setInvoiceData({...invoiceData, loading_charges: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Other Charges (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.other_charges}
                      onChange={(e) => setInvoiceData({...invoiceData, other_charges: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>

              {/* TCS */}
              <Card className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Checkbox
                    id="tcs"
                    checked={invoiceData.tcs_applicable}
                    onCheckedChange={(checked) => setInvoiceData({...invoiceData, tcs_applicable: checked})}
                  />
                  <Label htmlFor="tcs" className="font-bold cursor-pointer">TCS Applicable</Label>
                </div>
                
                {invoiceData.tcs_applicable && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>TCS Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.tcs_rate}
                        onChange={(e) => setInvoiceData({...invoiceData, tcs_rate: e.target.value})}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-sm text-gray-600">TCS Amount</p>
                      <p className="text-xl font-bold">₹ {invoiceData.tcs_amount}</p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Broker Details */}
              {invoiceData.has_broker && (
                <Card className="p-4">
                  <h3 className="font-bold mb-3">Broker Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Broker Name</Label>
                      <Input
                        value={invoiceData.broker_name}
                        onChange={(e) => setInvoiceData({...invoiceData, broker_name: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Brokerage Type</Label>
                      <Select 
                        value={invoiceData.brokerage_type} 
                        onValueChange={(val) => setInvoiceData({...invoiceData, brokerage_type: val})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BROKERAGE_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Brokerage Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.brokerage_rate}
                        onChange={(e) => setInvoiceData({...invoiceData, brokerage_rate: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* Remarks */}
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={invoiceData.remarks}
                  onChange={(e) => setInvoiceData({...invoiceData, remarks: e.target.value})}
                  placeholder="Any additional notes..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Totals Summary */}
              <Card className="p-4 bg-gray-50">
                <h3 className="font-bold mb-3">Invoice Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal (including taxes & charges):</span>
                    <span className="font-medium">₹ {invoiceData.subtotal}</span>
                  </div>
                  {invoiceData.tcs_applicable && (
                    <div className="flex justify-between">
                      <span>TCS Amount:</span>
                      <span className="font-medium">₹ {invoiceData.tcs_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Round Off:</span>
                    <span className="font-medium">₹ {invoiceData.round_off}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2">
                    <span>Grand Total:</span>
                    <span className="text-green-600">₹ {invoiceData.grand_total}</span>
                  </div>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitInvoice} 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : `Create ${isReturn ? 'Return' : 'Invoice'}`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default SalesInvoicePage;
