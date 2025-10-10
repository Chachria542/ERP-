import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function WeighbridgePage({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Pre-entry form state
  const [gateEntryNo, setGateEntryNo] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [tokenNo, setTokenNo] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Truck');
  const [itemId, setItemId] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

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

  const generateGateEntryNo = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `GT${timestamp}`;
  };

  const handleCreatePreEntry = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!farmerName || !mobile || !vehicleNumber || !itemId || !grossWeight || !tareWeight) {
      toast.error('Please fill all required fields');
      return;
    }

    if (mobile.length !== 10) {
      toast.error('Mobile number must be 10 digits');
      return;
    }

    const grossWt = parseFloat(grossWeight);
    const tareWt = parseFloat(tareWeight);

    if (grossWt <= tareWt) {
      toast.error('Gross weight must be greater than tare weight');
      return;
    }
    
    try {
      const autoGateEntry = gateEntryNo || generateGateEntryNo();
      
      const response = await axios.post(`${API}/weighbridge/pre-entry`, {
        gate_entry_no: autoGateEntry,
        farmer_name: farmerName,
        mobile: mobile,
        city: city || null,
        token_no: tokenNo || null,
        vehicle_number: vehicleNumber,
        vehicle_type: vehicleType,
        item_id: itemId,
        gross_weight: grossWt,
        tare_weight: tareWt
      });
      
      toast.success(`Pre-entry created! Gate Entry No: ${response.data.gate_entry_no}, Slip No: ${response.data.slip_number}`);
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create pre-entry');
    }
  };

  const resetForm = () => {
    setGateEntryNo('');
    setFarmerName('');
    setMobile('');
    setCity('');
    setTokenNo('');
    setVehicleNumber('');
    setVehicleType('Truck');
    setItemId('');
    setGrossWeight('');
    setTareWeight('');
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
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Weighbridge Pre-Entry</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>तुलन केंद्र - पूर्व प्रविष्टि</p>
          </div>
          
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            className="btn-primary" 
            data-testid="create-pre-entry-button"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Pre-Entry
          </Button>
        </div>

        {/* Instructions Card */}
        <Card className="p-6 mb-8" style={{background: 'linear-gradient(135deg, rgba(107, 142, 35, 0.1) 0%, rgba(212, 175, 55, 0.1) 100%)'}}>
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>
            📋 Weighbridge Pre-Entry Instructions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <div className="text-3xl">1️⃣</div>
              <div>
                <h3 className="font-bold mb-1" style={{color: '#6B8E23'}}>Create Pre-Entry</h3>
                <p className="text-sm" style={{color: '#6B5846'}}>
                  Record farmer details, vehicle, item, and weights (gross & tare)
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-3xl">2️⃣</div>
              <div>
                <h3 className="font-bold mb-1" style={{color: '#6B8E23'}}>Get Gate Entry No</h3>
                <p className="text-sm" style={{color: '#6B5846'}}>
                  System generates unique Gate Entry Number (auto or manual)
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-3xl">3️⃣</div>
              <div>
                <h3 className="font-bold mb-1" style={{color: '#6B8E23'}}>Use in Farmer Payment</h3>
                <p className="text-sm" style={{color: '#6B5846'}}>
                  Enter Gate Entry No in Farmer Payment to auto-fill details
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Create Pre-Entry Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl" style={{color: '#3E2723'}}>
                Create Weighbridge Pre-Entry
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleCreatePreEntry} className="space-y-6">
              {/* Gate Entry No */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gateEntryNo" className="text-sm font-semibold">
                    Gate Entry No. / गेट एंट्री नं. (Optional - Auto-generated)
                  </Label>
                  <Input
                    id="gateEntryNo"
                    data-testid="gate-entry-no-input"
                    value={gateEntryNo}
                    onChange={(e) => setGateEntryNo(e.target.value)}
                    placeholder="Leave empty for auto-generation"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tokenNo" className="text-sm font-semibold">
                    Token No. / टोकन नं. (Optional)
                  </Label>
                  <Input
                    id="tokenNo"
                    data-testid="token-no-input"
                    value={tokenNo}
                    onChange={(e) => setTokenNo(e.target.value)}
                    placeholder="Token number"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Farmer Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>
                  Farmer Details / किसान विवरण
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="farmerName" className="text-sm font-semibold">
                      Farmer Name / किसान का नाम *
                    </Label>
                    <Input
                      id="farmerName"
                      data-testid="farmer-name-input"
                      value={farmerName}
                      onChange={(e) => setFarmerName(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mobile" className="text-sm font-semibold">
                      Mobile / मोबाइल नं. *
                    </Label>
                    <Input
                      id="mobile"
                      data-testid="mobile-input"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      maxLength={10}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city" className="text-sm font-semibold">
                      City / शहर (Optional)
                    </Label>
                    <Input
                      id="city"
                      data-testid="city-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle & Item Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>
                  Vehicle & Item / वाहन और वस्तु विवरण
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="vehicleNumber" className="text-sm font-semibold">
                      Vehicle Number / वाहन नं. *
                    </Label>
                    <Input
                      id="vehicleNumber"
                      data-testid="vehicle-number-input"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      placeholder="MP09AB1234"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleType" className="text-sm font-semibold">
                      Vehicle Type / वाहन प्रकार *
                    </Label>
                    <select
                      id="vehicleType"
                      data-testid="vehicle-type-select"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="erp-select mt-1"
                      required
                    >
                      <option value="Truck">Truck / ट्रक</option>
                      <option value="Tractor">Tractor / ट्रैक्टर</option>
                      <option value="Hammali">Hammali / हम्माली</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="item" className="text-sm font-semibold">
                      Item / वस्तु *
                    </Label>
                    <select
                      id="item"
                      data-testid="item-select"
                      value={itemId}
                      onChange={(e) => setItemId(e.target.value)}
                      className="erp-select mt-1"
                      required
                    >
                      <option value="">Select Item</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Weight Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>
                  Weight Details / वजन विवरण
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grossWeight" className="text-sm font-semibold">
                      Gross Weight / भरा वजन (kg) *
                    </Label>
                    <Input
                      id="grossWeight"
                      data-testid="gross-weight-input"
                      type="number"
                      step="0.01"
                      value={grossWeight}
                      onChange={(e) => setGrossWeight(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tareWeight" className="text-sm font-semibold">
                      Tare Weight / खाली वजन (kg) *
                    </Label>
                    <Input
                      id="tareWeight"
                      data-testid="tare-weight-input"
                      type="number"
                      step="0.01"
                      value={tareWeight}
                      onChange={(e) => setTareWeight(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {/* Net Weight Calculation Preview */}
                {grossWeight && tareWeight && parseFloat(grossWeight) > parseFloat(tareWeight) && (
                  <div className="mt-4 p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Net Weight / निवल वजन</p>
                        <p className="text-xl font-bold" style={{color: '#6B8E23'}}>
                          {(parseFloat(grossWeight) - parseFloat(tareWeight)).toFixed(2)} kg
                        </p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Bags / बोरे</p>
                        <p className="text-xl font-bold" style={{color: '#6B8E23'}}>
                          {Math.floor((parseFloat(grossWeight) - parseFloat(tareWeight)) / 100)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Quintals / कुंटल</p>
                        <p className="text-xl font-bold" style={{color: '#6B8E23'}}>
                          {((parseFloat(grossWeight) - parseFloat(tareWeight)) / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button 
                  type="button" 
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }} 
                  className="btn-secondary"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="btn-primary" 
                  data-testid="submit-pre-entry"
                >
                  Create Pre-Entry
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default WeighbridgePage;
