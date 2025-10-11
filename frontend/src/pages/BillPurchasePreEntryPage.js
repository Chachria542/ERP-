import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

function BillPurchasePreEntryPage({ user, onLogout }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [createdPreEntry, setCreatedPreEntry] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    supplier_gstin: '',
    place_of_supply: '',
    item_id: '',
    item_name: '',
    has_broker: false,
    broker_name: '',
    brokerage_type: 'none',
    brokerage_rate: '',
    eway_bill_no: '',
    expected_quantity_bags: '',
    expected_quantity_kgs: '',
    expected_quantity_qtls: '',
    remarks: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchSuppliers();
    fetchItems();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API}/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplier_id: supplierId,
        supplier_gstin: supplier.gstin || '',
        place_of_supply: supplier.place_of_supply || ''
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleBrokerToggle = (checked) => {
    setFormData(prev => ({
      ...prev,
      has_broker: checked,
      broker_name: checked ? prev.broker_name : '',
      brokerage_type: checked ? prev.brokerage_type : 'none',
      brokerage_rate: checked ? prev.brokerage_rate : ''
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.supplier_id) {
      newErrors.supplier_id = 'Supplier is required';
    }
    
    if (!formData.place_of_supply.trim()) {
      newErrors.place_of_supply = 'Place of supply is required';
    }
    
    if (formData.has_broker) {
      if (!formData.broker_name.trim()) {
        newErrors.broker_name = 'Broker name is required when broker is enabled';
      }
      
      if (formData.brokerage_type !== 'none' && !formData.brokerage_rate) {
        newErrors.brokerage_rate = 'Brokerage rate is required when brokerage type is selected';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Prepare submission data
      const submitData = {
        ...formData,
        expected_quantity_bags: formData.expected_quantity_bags ? parseInt(formData.expected_quantity_bags) : null,
        expected_quantity_kgs: formData.expected_quantity_kgs ? parseFloat(formData.expected_quantity_kgs) : null,
        expected_quantity_qtls: formData.expected_quantity_qtls ? parseFloat(formData.expected_quantity_qtls) : null,
        brokerage_rate: formData.brokerage_rate ? parseFloat(formData.brokerage_rate) : null,
        created_by: user.username
      };
      
      const response = await axios.post(`${API}/bill-purchase/pre-entry`, submitData);
      
      setCreatedPreEntry(response.data);
      setShowQRModal(true);
      setShowForm(false);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        supplier_gstin: '',
        place_of_supply: '',
        has_broker: false,
        broker_name: '',
        brokerage_type: 'none',
        brokerage_rate: '',
        eway_bill_no: '',
        expected_quantity_bags: '',
        expected_quantity_kgs: '',
        expected_quantity_qtls: '',
        remarks: ''
      });
      
      toast.success('Pre-entry created successfully!');
      
    } catch (error) {
      console.error('Error creating pre-entry:', error);
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to create pre-entry');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    if (!createdPreEntry) return;
    
    // Create print content
    const printContent = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2>Bill Purchase Pre-Entry Slip</h2>
          <h3>Sudarshan Trading Company</h3>
        </div>
        
        <div style="margin-bottom: 20px;">
          <strong>Pre-Entry No:</strong> ${createdPreEntry.pre_entry_number}<br>
          <strong>Date:</strong> ${createdPreEntry.date}<br>
          <strong>Supplier:</strong> ${createdPreEntry.supplier_name}<br>
          <strong>GSTIN:</strong> ${createdPreEntry.supplier_gstin || 'N/A'}<br>
          <strong>Place of Supply:</strong> ${createdPreEntry.place_of_supply}
        </div>
        
        ${createdPreEntry.has_broker ? `
          <div style="margin-bottom: 20px;">
            <strong>Broker:</strong> ${createdPreEntry.broker_name}<br>
            <strong>Brokerage Type:</strong> ${createdPreEntry.brokerage_type}<br>
            <strong>Brokerage Rate:</strong> ${createdPreEntry.brokerage_rate || 'N/A'}
          </div>
        ` : ''}
        
        ${createdPreEntry.eway_bill_no ? `
          <div style="margin-bottom: 20px;">
            <strong>E-Way Bill No:</strong> ${createdPreEntry.eway_bill_no}
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="border: 2px solid #000; padding: 10px; display: inline-block;">
            <div>QR Code: ${createdPreEntry.qr_code}</div>
            <div style="margin-top: 10px; font-size: 12px;">
              Scan this code at weighbridge
            </div>
          </div>
        </div>
        
        <div style="margin-top: 30px; text-align: center; font-size: 12px;">
          Generated by: ${user.name} | ${new Date().toLocaleString()}
        </div>
      </div>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading suppliers...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Bill Purchase Pre-Entry</h1>
            <p className="text-gray-600 mt-1">Create pre-entry for incoming supplier trucks</p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            + Create Pre-Entry
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🚛</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
                <p className="text-2xl font-bold text-gray-800">{suppliers.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Pre-Entries</p>
                <p className="text-2xl font-bold text-gray-800">0</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Weighing</p>
                <p className="text-2xl font-bold text-gray-800">0</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pre-Entry Form Modal */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Bill Purchase Pre-Entry</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date */}
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                </div>

                {/* Supplier */}
                <div>
                  <Label htmlFor="supplier">Supplier *</Label>
                  <Select value={formData.supplier_id} onValueChange={handleSupplierChange}>
                    <SelectTrigger className={errors.supplier_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name} {supplier.gstin ? `(${supplier.gstin})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.supplier_id && (
                    <p className="text-sm text-red-600 mt-1">{errors.supplier_id}</p>
                  )}
                </div>

                {/* Supplier GSTIN */}
                <div>
                  <Label htmlFor="supplier_gstin">Supplier GSTIN</Label>
                  <Input
                    id="supplier_gstin"
                    value={formData.supplier_gstin}
                    onChange={(e) => handleInputChange('supplier_gstin', e.target.value)}
                    placeholder="Auto-filled from supplier"
                  />
                </div>

                {/* Place of Supply */}
                <div>
                  <Label htmlFor="place_of_supply">Place of Supply *</Label>
                  <Input
                    id="place_of_supply"
                    value={formData.place_of_supply}
                    onChange={(e) => handleInputChange('place_of_supply', e.target.value)}
                    className={errors.place_of_supply ? 'border-red-500' : ''}
                    placeholder="e.g., Mumbai, Maharashtra"
                    required
                  />
                  {errors.place_of_supply && (
                    <p className="text-sm text-red-600 mt-1">{errors.place_of_supply}</p>
                  )}
                </div>

                {/* E-Way Bill No */}
                <div>
                  <Label htmlFor="eway_bill_no">E-Way Bill No.</Label>
                  <Input
                    id="eway_bill_no"
                    value={formData.eway_bill_no}
                    onChange={(e) => handleInputChange('eway_bill_no', e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Broker Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_broker"
                    checked={formData.has_broker}
                    onCheckedChange={handleBrokerToggle}
                  />
                  <Label htmlFor="has_broker">Has Broker</Label>
                </div>

                {formData.has_broker && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="broker_name">Broker Name *</Label>
                      <Input
                        id="broker_name"
                        value={formData.broker_name}
                        onChange={(e) => handleInputChange('broker_name', e.target.value)}
                        className={errors.broker_name ? 'border-red-500' : ''}
                        required={formData.has_broker}
                      />
                      {errors.broker_name && (
                        <p className="text-sm text-red-600 mt-1">{errors.broker_name}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="brokerage_type">Brokerage Type</Label>
                      <Select value={formData.brokerage_type} onValueChange={(value) => handleInputChange('brokerage_type', value)}>
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

                    {formData.brokerage_type !== 'none' && (
                      <div>
                        <Label htmlFor="brokerage_rate">
                          Brokerage Rate {formData.brokerage_type === 'percentage' ? '(%)' : '(₹)'}
                        </Label>
                        <Input
                          id="brokerage_rate"
                          type="number"
                          step="0.01"
                          value={formData.brokerage_rate}
                          onChange={(e) => handleInputChange('brokerage_rate', e.target.value)}
                          className={errors.brokerage_rate ? 'border-red-500' : ''}
                        />
                        {errors.brokerage_rate && (
                          <p className="text-sm text-red-600 mt-1">{errors.brokerage_rate}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expected Quantity */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Expected Quantity (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="expected_quantity_bags">Bags</Label>
                    <Input
                      id="expected_quantity_bags"
                      type="number"
                      value={formData.expected_quantity_bags}
                      onChange={(e) => handleInputChange('expected_quantity_bags', e.target.value)}
                      placeholder="e.g., 100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="expected_quantity_kgs">Kgs</Label>
                    <Input
                      id="expected_quantity_kgs"
                      type="number"
                      step="0.01"
                      value={formData.expected_quantity_kgs}
                      onChange={(e) => handleInputChange('expected_quantity_kgs', e.target.value)}
                      placeholder="e.g., 10000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="expected_quantity_qtls">Quintals</Label>
                    <Input
                      id="expected_quantity_qtls"
                      type="number"
                      step="0.01"
                      value={formData.expected_quantity_qtls}
                      onChange={(e) => handleInputChange('expected_quantity_qtls', e.target.value)}
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  placeholder="Optional remarks"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Pre-Entry'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* QR Code Modal */}
        <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pre-Entry Created Successfully!</DialogTitle>
            </DialogHeader>
            
            {createdPreEntry && (
              <div className="space-y-4 text-center">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-green-800">
                    {createdPreEntry.pre_entry_number}
                  </h3>
                  <p className="text-green-600">Pre-Entry Number</p>
                </div>
                
                <div className="space-y-2">
                  <p><strong>Supplier:</strong> {createdPreEntry.supplier_name}</p>
                  <p><strong>Date:</strong> {createdPreEntry.date}</p>
                  {createdPreEntry.eway_bill_no && (
                    <p><strong>E-Way Bill:</strong> {createdPreEntry.eway_bill_no}</p>
                  )}
                </div>
                
                <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
                  <div className="text-xs text-gray-600 mb-2">QR Code Data:</div>
                  <div className="text-sm font-mono bg-gray-100 p-2 rounded">
                    {createdPreEntry.qr_code}
                  </div>
                </div>
                
                <Button 
                  onClick={handlePrintSlip}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Print Pre-Entry Slip
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default BillPurchasePreEntryPage;