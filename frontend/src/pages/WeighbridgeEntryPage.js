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

function WeighbridgeEntryPage({ user, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [preEntry, setPreEntry] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdEntry, setCreatedEntry] = useState(null);

  // Form state
  const [slipId, setSlipId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Truck');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [shift, setShift] = useState('Morning');
  
  // For Sales TARE/GROSS flow
  const [weightType, setWeightType] = useState('single'); // 'single', 'tare', 'gross'
  const [measuredWeight, setMeasuredWeight] = useState('');
  const [existingTareWeight, setExistingTareWeight] = useState(0);

  // Calculated fields
  const [netWeight, setNetWeight] = useState(0);
  const [bags, setBags] = useState(0);
  const [quintals, setQuintals] = useState(0);

  useEffect(() => {
    // Calculate net weight and quantities
    const gross = parseFloat(grossWeight) || 0;
    const tare = parseFloat(tareWeight) || 0;
    const net = gross - tare;
    
    if (net > 0) {
      setNetWeight(net);
      setBags(Math.floor(net / 100));
      setQuintals((net / 100).toFixed(2));
    } else {
      setNetWeight(0);
      setBags(0);
      setQuintals(0);
    }
  }, [grossWeight, tareWeight]);

  const handleScanQR = async () => {
    if (!slipId) {
      toast.error('Please enter Slip ID');
      return;
    }

    setLoading(true);
    try {
      // Fetch pre-entry
      const response = await axios.get(`${API}/pre-entry/${slipId}`);
      setPreEntry(response.data);
      
      // Check if it's a Sales transaction
      if (response.data.transaction_type === 'sale') {
        // Check if tare weight already exists
        if (response.data.tare_weight && response.data.tare_weight > 0) {
          // Tare already completed, now enter Gross
          setWeightType('gross');
          setExistingTareWeight(response.data.tare_weight);
          toast.info('Tare weight already recorded. Please enter GROSS weight (loaded truck)');
        } else {
          // First weighment - enter Tare
          setWeightType('tare');
          toast.info('Please enter TARE weight (empty truck)');
        }
      } else {
        // Regular transaction - single weighment
        setWeightType('single');
      }
      
      setShowForm(true);
      toast.success(`Pre-entry loaded: ${response.data.party_name || response.data.customer_name}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Pre-entry not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!vehicleNumber || !grossWeight || !tareWeight) {
      toast.error('Please fill all required fields');
      return;
    }

    const gross = parseFloat(grossWeight);
    const tare = parseFloat(tareWeight);

    if (gross <= tare) {
      toast.error('Gross weight must be greater than tare weight');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        slip_id: slipId,
        vehicle_number: vehicleNumber.toUpperCase(),
        vehicle_type: vehicleType,
        driver_name: driverName || null,
        driver_mobile: driverMobile || null,
        gross_weight: gross,
        tare_weight: tare,
        operator_id: user.id,
        operator_name: user.name,
        shift: shift
      };

      const response = await axios.post(`${API}/weighbridge-entry`, payload);
      
      setCreatedEntry(response.data);
      setShowSuccessModal(true);
      setShowForm(false);
      resetForm();
      toast.success('Weighbridge entry created successfully!');
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSlipId('');
    setVehicleNumber('');
    setVehicleType('Truck');
    setDriverName('');
    setDriverMobile('');
    setGrossWeight('');
    setTareWeight('');
    setPreEntry(null);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Weighbridge Entry</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Scan QR and record weights</p>
        </div>

        {/* QR Scan Section */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>
            📱 Scan QR Code / Enter Slip ID
          </h2>
          <div className="flex space-x-4">
            <div className="flex-1">
              <Label className="text-sm font-semibold">Slip ID *</Label>
              <Input
                value={slipId}
                onChange={(e) => setSlipId(e.target.value.toUpperCase())}
                placeholder="WB-25-000001"
                className="mt-1"
                disabled={showForm}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleScanQR} 
                className="btn-primary"
                disabled={loading || showForm}
              >
                {loading ? 'Loading...' : '🔍 Fetch Pre-Entry'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Pre-Entry Details (After Scan) */}
        {preEntry && showForm && (
          <Card className="p-6 mb-8" style={{background: 'rgba(107, 142, 35, 0.05)'}}>
            <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>
              ✅ Pre-Entry Details
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm" style={{color: '#6B5846'}}>Transaction Type</p>
                <p className="font-bold">{preEntry.transaction_type}</p>
              </div>
              <div>
                <p className="text-sm" style={{color: '#6B5846'}}>Party Name</p>
                <p className="font-bold">{preEntry.party_name}</p>
              </div>
              <div>
                <p className="text-sm" style={{color: '#6B5846'}}>Item</p>
                <p className="font-bold">{preEntry.item_name}</p>
              </div>
              <div>
                <p className="text-sm" style={{color: '#6B5846'}}>Expected Bags</p>
                <p className="font-bold">{preEntry.expected_bags || 'N/A'}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Weighbridge Entry Form */}
        {showForm && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6" style={{color: '#3E2723'}}>
              ⚖️ Record Weights
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vehicle Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Vehicle Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Vehicle Number *</Label>
                    <Input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="MP09AB1234"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Vehicle Type *</Label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="erp-select mt-1"
                      required
                    >
                      <option value="Truck">Truck</option>
                      <option value="Tractor">Tractor</option>
                      <option value="Hammali">Hammali</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Shift</Label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      className="erp-select mt-1"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label className="text-sm font-semibold">Driver Name</Label>
                    <Input
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Optional"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Driver Mobile</Label>
                    <Input
                      value={driverMobile}
                      onChange={(e) => setDriverMobile(e.target.value)}
                      placeholder="Optional"
                      maxLength={10}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Weight Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Weight Measurement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Gross Weight (kg) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={grossWeight}
                      onChange={(e) => setGrossWeight(e.target.value)}
                      placeholder="Weight with load"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Tare Weight (kg) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tareWeight}
                      onChange={(e) => setTareWeight(e.target.value)}
                      placeholder="Empty vehicle weight"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                {/* Calculated Values */}
                {netWeight > 0 && (
                  <div className="mt-6 p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <h4 className="font-bold mb-3" style={{color: '#3E2723'}}>Calculated Values</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Net Weight</p>
                        <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>{netWeight.toFixed(2)} kg</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Bags</p>
                        <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>{bags}</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Quintals</p>
                        <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>{quintals}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Photo Capture (Mock) */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Photos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border-2 border-dashed rounded-lg text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Gross Weight Photo</p>
                    <p className="text-xs text-gray-500">(Mock - Will use camera)</p>
                  </div>
                  <div className="p-4 border-2 border-dashed rounded-lg text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Tare Weight Photo</p>
                    <p className="text-xs text-gray-500">(Mock - Will use camera)</p>
                  </div>
                </div>
              </div>

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
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Weighbridge Entry'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center" style={{color: '#3E2723'}}>
                ✅ Weighbridge Entry Saved!
              </DialogTitle>
            </DialogHeader>
            
            {createdEntry && (
              <div className="space-y-4">
                <div className="text-center p-6 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                  <p className="text-sm mb-2" style={{color: '#6B5846'}}>Slip ID</p>
                  <p className="text-2xl font-bold mb-4" style={{color: '#6B8E23'}}>{createdEntry.slip_id}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div>
                      <p className="text-xs" style={{color: '#6B5846'}}>Net Weight</p>
                      <p className="font-bold">{createdEntry.net_weight} kg</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{color: '#6B5846'}}>Quintals</p>
                      <p className="font-bold">{createdEntry.act_qtl}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-semibold mb-2">✅ Next Step:</p>
                  <p className="text-sm">
                    {createdEntry.transaction_type === 'farmer_purchase' 
                      ? 'Slip ready for Farmer Payment module'
                      : 'Slip ready for respective module'}
                  </p>
                </div>
                
                <Button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    setCreatedEntry(null);
                  }} 
                  className="btn-primary w-full"
                >
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default WeighbridgeEntryPage;
