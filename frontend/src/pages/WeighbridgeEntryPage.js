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
          
          // Auto-fill and lock vehicle number from TARE entry
          if (response.data.vehicle_number_from_tare) {
            setVehicleNumber(response.data.vehicle_number_from_tare);
          }
          
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
    
    // Validation based on weight type
    if (weightType === 'single') {
      // Regular flow - both gross and tare required
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
    } else if (weightType === 'tare' || weightType === 'gross') {
      // Sales flow - only measured weight required
      if (!vehicleNumber || !measuredWeight) {
        toast.error('Please fill all required fields');
        return;
      }
    }

    setLoading(true);
    try {
      let payload;
      
      if (weightType === 'single') {
        // Regular single weighment
        payload = {
          slip_id: slipId,
          vehicle_number: vehicleNumber.toUpperCase(),
          vehicle_type: vehicleType,
          driver_name: driverName || null,
          driver_mobile: driverMobile || null,
          gross_weight: parseFloat(grossWeight),
          tare_weight: parseFloat(tareWeight),
          weight_type: 'single',
          operator_id: user.id,
          operator_name: user.name,
          shift: shift
        };
      } else {
        // Sales TARE or GROSS weighment
        payload = {
          slip_id: slipId,
          vehicle_number: vehicleNumber.toUpperCase(),
          vehicle_type: vehicleType,
          driver_name: driverName || null,
          driver_mobile: driverMobile || null,
          weight: parseFloat(measuredWeight),
          weight_type: weightType,
          operator_id: user.id,
          operator_name: user.name,
          shift: shift
        };
      }

      const response = await axios.post(`${API}/weighbridge-entry`, payload);
      
      setCreatedEntry(response.data);
      setShowSuccessModal(true);
      setShowForm(false);
      resetForm();
      
      if (weightType === 'tare') {
        toast.success('TARE weight recorded! Vehicle can now proceed for loading.');
      } else if (weightType === 'gross') {
        toast.success('GROSS weight recorded! Net weight calculated. Ready for invoice.');
      } else {
        toast.success('Weighbridge entry created successfully!');
      }
      
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
    setMeasuredWeight('');
    setWeightType('single');
    setExistingTareWeight(0);
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
                <p className="text-sm" style={{color: '#6B5846'}}>
                  {preEntry.transaction_type === 'sale' ? 'Customer Name' : 'Party Name'}
                </p>
                <p className="font-bold">{preEntry.party_name || preEntry.customer_name}</p>
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
                <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>
                  Weight Measurement
                  {weightType === 'tare' && <span className="ml-2 text-blue-600">(Step 1: TARE - Empty Truck)</span>}
                  {weightType === 'gross' && <span className="ml-2 text-green-600">(Step 2: GROSS - Loaded Truck)</span>}
                </h3>
                
                {weightType === 'single' ? (
                  // Regular single weighment (Purchase flow)
                  <>
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
                  </>
                ) : weightType === 'tare' ? (
                  // TARE weighment (Sales - Step 1)
                  <>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <p className="text-sm text-blue-800">
                        📦 Record the weight of the <strong>EMPTY</strong> truck before loading.
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">TARE Weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={measuredWeight}
                        onChange={(e) => setMeasuredWeight(e.target.value)}
                        placeholder="Empty vehicle weight"
                        className="mt-1 text-2xl"
                        required
                      />
                    </div>
                  </>
                ) : (
                  // GROSS weighment (Sales - Step 2)
                  <>
                    <div className="bg-green-50 p-4 rounded-lg mb-4">
                      <p className="text-sm text-green-800">
                        🚛 Record the weight of the <strong>LOADED</strong> truck after loading.
                      </p>
                      <p className="text-sm text-green-700 mt-2">
                        <strong>Previous TARE weight:</strong> {existingTareWeight.toFixed(2)} kg
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">GROSS Weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={measuredWeight}
                        onChange={(e) => setMeasuredWeight(e.target.value)}
                        placeholder="Loaded vehicle weight"
                        className="mt-1 text-2xl"
                        required
                      />
                    </div>
                    
                    {/* Calculate and show net weight preview */}
                    {measuredWeight && parseFloat(measuredWeight) > existingTareWeight && (
                      <div className="mt-4 p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                        <h4 className="font-bold mb-2" style={{color: '#3E2723'}}>Net Weight Preview</h4>
                        <p className="text-3xl font-bold" style={{color: '#6B8E23'}}>
                          {(parseFloat(measuredWeight) - existingTareWeight).toFixed(2)} kg
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          ({((parseFloat(measuredWeight) - existingTareWeight) / 100).toFixed(2)} quintals)
                        </p>
                      </div>
                    )}
                  </>
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
