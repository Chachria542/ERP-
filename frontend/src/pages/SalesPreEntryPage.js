import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import BrokerAutocomplete from '../components/BrokerAutocomplete';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BHARTI_OPTIONS = [
  { value: 100, label: '100 kg' },
  { value: 50, label: '50 kg' },
  { value: 35, label: '35 kg' },
  { value: 30, label: '30 kg' },
  { value: 25, label: '25 kg' }
];

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

function SalesPreEntryPage({ user, onLogout }) {
  // Master data
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [markaOptions, setMarkaOptions] = useState([]);
  
  // Form state
  const [orderNumber, setOrderNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [isMandi, setIsMandi] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [itemId, setItemId] = useState('');
  const [itemRate, setItemRate] = useState('');
  const [marka, setMarka] = useState('');
  const [customMarka, setCustomMarka] = useState('');
  const [bharti, setBharti] = useState(50);
  const [expectedBags, setExpectedBags] = useState('');
  const [expectedKgs, setExpectedKgs] = useState('');
  const [hasBroker, setHasBroker] = useState(true);
  const [brokerId, setBrokerId] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerageType, setBrokerageType] = useState('per_quintal');
  const [brokerageRate, setBrokerageRate] = useState('');
  const [remarks, setRemarks] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchItems();
  }, []);

  // Fetch customers (parties with role=customer)
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

  // Fetch items
  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API}/items`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
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

  // Handle customer selection
  const handleCustomerSelect = (customerId) => {
    setCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerGstin(customer.gstin || '');
      setPlaceOfSupply(customer.place_of_supply || '');
    }
  };

  // Handle item selection
  const handleItemSelect = (itemId) => {
    setItemId(itemId);
    const item = items.find(i => i.id === itemId);
    if (item) {
      setItemRate(item.rate || '');
      console.log('[Sales Pre-Entry] Auto-filled rate:', item.rate, 'for item:', item.name);
    }
    // Fetch marka options for this item
    fetchMarkaOptions(itemId);
    setMarka(''); // Reset marka selection
  };

  // Handle broker selection
  const handleBrokerSelect = (broker) => {
    setBrokerId(broker.id);
    setBrokerName(broker.name);
    setBrokerageType(broker.default_brokerage_type || 'per_quintal');
    setBrokerageRate(broker.default_brokerage_rate || '');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!customerId || !placeOfSupply) {
      toast.error('Customer and Place of Supply are required');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        date: new Date().toISOString().split('T')[0],
        order_number: orderNumber || null,
        customer_id: customerId,
        customer_gstin: customerGstin || null,
        place_of_supply: placeOfSupply,
        is_mandi: isMandi,
        location_name: locationName || null,
        item_id: itemId || null,
        item_rate: itemRate ? parseFloat(itemRate) : null,
        marka: customMarka || marka || null,
        bharti: bharti,
        expected_bags: expectedBags ? parseInt(expectedBags) : null,
        expected_kgs: expectedKgs ? parseFloat(expectedKgs) : null,
        has_broker: hasBroker,
        broker_id: brokerId || null,
        broker_name: brokerName || null,
        brokerage_type: hasBroker && brokerageType !== 'none' ? brokerageType : null,
        brokerage_rate: hasBroker && brokerageRate ? parseFloat(brokerageRate) : null,
        remarks: remarks || null,
        created_by: user.username
      };

      console.log('[Sales Pre-Entry] Submitting:', payload);

      const response = await axios.post(`${API}/sales/pre-entry`, payload);
      
      toast.success(`Sales Pre-Entry created: ${response.data.pre_entry_number}`);
      
      // TODO: Print QR slip
      
      // Reset form
      resetForm();
      
    } catch (error) {
      console.error('Error creating sales pre-entry:', error);
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to create sales pre-entry');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setOrderNumber('');
    setCustomerId('');
    setCustomerGstin('');
    setPlaceOfSupply('');
    setIsMandi(false);
    setLocationName('');
    setItemId('');
    setItemRate('');
    setMarka('');
    setCustomMarka('');
    setBharti(50);
    setExpectedBags('');
    setExpectedKgs('');
    setHasBroker(true);
    setBrokerId('');
    setBrokerName('');
    setBrokerageType('per_quintal');
    setBrokerageRate('');
    setRemarks('');
    setMarkaOptions([]);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Sales Pre-Entry</h1>
            <p className="text-gray-600 mt-1">Create pre-entry before loading</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="p-6 space-y-6">
            
            {/* Order Number (Optional) */}
            <div>
              <Label>Order Number (Optional)</Label>
              <Input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Enter order number"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">For future order integration</p>
            </div>

            {/* Customer Details */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg">Customer Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Customer *</Label>
                  <Select value={customerId} onValueChange={handleCustomerSelect} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>GSTIN</Label>
                  <Input
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                    placeholder="Auto-filled from customer"
                    maxLength={15}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Place of Supply *</Label>
                  <Input
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    placeholder="e.g., Mumbai, Maharashtra"
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg">Location</h3>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="godown"
                    checked={!isMandi}
                    onChange={() => setIsMandi(false)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="godown" className="cursor-pointer">Godown (Default)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="mandi"
                    checked={isMandi}
                    onChange={() => setIsMandi(true)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="mandi" className="cursor-pointer">Mandi</Label>
                </div>
              </div>

              <div>
                <Label>Location Name (Optional)</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder={isMandi ? "Mandi name" : "Godown name"}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Item & Marka */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg">Item Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Item</Label>
                  <Select value={itemId} onValueChange={handleItemSelect}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Rate per Quintal (₹)</Label>
                  <Input
                    type="number"
                    className="no-spinner mt-1"
                    value={itemRate}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setItemRate(value);
                      }
                    }}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from item master</p>
                </div>

                <div>
                  <Label>Marka (Brand)</Label>
                  {markaOptions.length > 0 ? (
                    <Select value={marka} onValueChange={setMarka}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select or enter marka" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom (Type below)</SelectItem>
                        {markaOptions.map((m, idx) => (
                          <SelectItem key={idx} value={m.marka}>
                            {m.marka}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={customMarka}
                      onChange={(e) => setCustomMarka(e.target.value)}
                      placeholder="Enter marka"
                      className="mt-1"
                    />
                  )}
                </div>

                {marka === 'custom' && markaOptions.length > 0 && (
                  <div>
                    <Label>Custom Marka</Label>
                    <Input
                      value={customMarka}
                      onChange={(e) => setCustomMarka(e.target.value)}
                      placeholder="Enter new marka"
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label>Bharti (Pack Size)</Label>
                  <Select value={bharti.toString()} onValueChange={(val) => setBharti(parseInt(val))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BHARTI_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Expected Quantity */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg">Expected Quantity (Optional)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Expected Bags</Label>
                  <Input
                    type="number"
                    value={expectedBags}
                    onChange={(e) => setExpectedBags(e.target.value)}
                    placeholder="e.g., 100"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Expected Kgs</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expectedKgs}
                    onChange={(e) => setExpectedKgs(e.target.value)}
                    placeholder="e.g., 5000"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Broker Details */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_broker"
                  checked={hasBroker}
                  onChange={(e) => setHasBroker(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="has_broker" className="cursor-pointer font-semibold text-lg">
                  Has Broker
                </Label>
              </div>

              {hasBroker && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Broker Name</Label>
                    <BrokerAutocomplete
                      value={brokerName}
                      onSelect={handleBrokerSelect}
                      placeholder="Type broker name..."
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Brokerage Type</Label>
                    <Select value={brokerageType} onValueChange={setBrokerageType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BROKERAGE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Brokerage Rate</Label>
                    <Input
                      type="number"
                      className="no-spinner mt-1"
                      value={brokerageRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setBrokerageRate(value);
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Remarks */}
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline"
                onClick={resetForm}
              >
                Reset
              </Button>
              <Button 
                type="submit"
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'Creating...' : 'Create Pre-Entry & Print Slip'}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </Layout>
  );
}

export default SalesPreEntryPage;
