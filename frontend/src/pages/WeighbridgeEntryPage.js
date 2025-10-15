import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function WeighbridgeEntryPage({ user, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [preEntry, setPreEntry] = useState(null);
  const [transactionType, setTransactionType] = useState(null); // 'purchase' or 'sale'
  
  // Queue state
  const [queue, setQueue] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'farmer_purchase', 'bill_purchase', 'sale'
  const [showWeightCapture, setShowWeightCapture] = useState(false);
  
  // Form state
  const [slipId, setSlipId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Truck');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [shift, setShift] = useState('Morning');
  
  // Weight capture state
  const [firstWeightValue, setFirstWeightValue] = useState('');
  const [secondWeightValue, setSecondWeightValue] = useState('');
  const [firstWeightCaptured, setFirstWeightCaptured] = useState(false);
  const [secondWeightCaptured, setSecondWeightCaptured] = useState(false);
  
  // Existing weights from database
  const [existingTareWeight, setExistingTareWeight] = useState(null);
  const [existingGrossWeight, setExistingGrossWeight] = useState(null);
  
  // Calculated net weight
  const [netWeight, setNetWeight] = useState(0);
  const [bags, setBags] = useState(0);
  const [quintals, setQuintals] = useState(0);

  // Calculate net weight whenever weights change
  useEffect(() => {
    const gross = existingGrossWeight || 0;
    const tare = existingTareWeight || 0;

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
  }, [existingTareWeight, existingGrossWeight]);

  // Fetch queue on mount and when filter changes
  useEffect(() => {
    fetchQueue();
  }, [filterType]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = filterType !== 'all' ? `?transaction_type=${filterType}` : '';
      const response = await axios.get(`${API}/weighbridge/queue${params}`);
      setQueue(response.data.queue || []);
    } catch (error) {
      toast.error('Failed to fetch queue');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessEntry = (queueItem, action) => {
    // Load the queue item data and open weight capture form
    setSlipId(queueItem.slip_id);
    setPreEntry({
      ...queueItem,
      party_name: queueItem.party_name,
      customer_name: queueItem.party_name,
      transaction_type: queueItem.transaction_type
    });
    
    // Set transaction type
    if (queueItem.transaction_type === 'sale') {
      setTransactionType('sale');
    } else {
      setTransactionType('purchase');
    }
    
    // Set existing weights if any
    if (queueItem.tare_weight) {
      setExistingTareWeight(queueItem.tare_weight);
      setFirstWeightCaptured(true);
    }
    if (queueItem.gross_weight) {
      setExistingGrossWeight(queueItem.gross_weight);
      if (queueItem.transaction_type !== 'sale') {
        setFirstWeightCaptured(true);
      }
    }
    
    // Pre-fill vehicle details if available
    if (queueItem.vehicle_number) {
      setVehicleNumber(queueItem.vehicle_number);
    }
    if (queueItem.vehicle_type) {
      setVehicleType(queueItem.vehicle_type);
    }
    
    setShowWeightCapture(true);
    toast.info(`Processing ${action.toUpperCase()} weight for ${queueItem.slip_id}`);
  };

  const handleFetchSlip = async () => {
    if (!slipId.trim()) {
      toast.error('Please enter a slip ID');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/pre-entry/${slipId.trim()}`);
      const data = response.data;
      setPreEntry(data);

      // Determine transaction type
      const txType = data.transaction_type;
      if (txType === 'sale') {
        setTransactionType('sale');
        
        // Check if TARE already captured
        if (data.tare_weight && data.tare_weight > 0) {
          setExistingTareWeight(data.tare_weight);
          setFirstWeightCaptured(true);
          setVehicleNumber(data.vehicle_number_from_tare || '');
          toast.info('TARE weight already recorded. Please enter GROSS weight (loaded truck)');
        } else {
          toast.info('Sales transaction: First enter TARE weight (empty truck)');
        }
      } else {
        // Farmer purchase or bill purchase
        setTransactionType('purchase');
        
        // Check if already weighed
        if (data.status === 'weighed' || data.weighbridge_completed) {
          toast.error('This slip has already been fully weighed');
          setPreEntry(null);
          return;
        }
        
        toast.info('Purchase transaction: First enter GROSS weight (loaded truck)');
      }

      toast.success(`Pre-entry loaded: ${data.party_name || data.customer_name}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Pre-entry not found');
      setPreEntry(null);
      setTransactionType(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureFirstWeight = async () => {
    if (!vehicleNumber.trim() || !firstWeightValue.trim()) {
      toast.error('Please fill vehicle number and weight');
      return;
    }

    const weight = parseFloat(firstWeightValue);
    if (weight <= 0) {
      toast.error('Weight must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      let payload;
      
      if (transactionType === 'purchase') {
        // Purchase: GROSS weight first
        payload = {
          slip_id: slipId,
          vehicle_number: vehicleNumber.toUpperCase(),
          vehicle_type: vehicleType,
          driver_name: driverName || null,
          driver_mobile: driverMobile || null,
          weight: weight,
          weight_type: 'gross',
          operator_id: user.id,
          operator_name: user.name,
          shift: shift
        };
      } else {
        // Sale: TARE weight first
        payload = {
          slip_id: slipId,
          vehicle_number: vehicleNumber.toUpperCase(),
          vehicle_type: vehicleType,
          driver_name: driverName || null,
          driver_mobile: driverMobile || null,
          weight: weight,
          weight_type: 'tare',
          operator_id: user.id,
          operator_name: user.name,
          shift: shift
        };
      }

      const response = await axios.post(`${API}/weighbridge-entry`, payload);
      
      setFirstWeightCaptured(true);
      
      if (transactionType === 'purchase') {
        setExistingGrossWeight(weight);
        toast.success('✅ GROSS weight recorded! Vehicle can now proceed for unloading.');
      } else {
        setExistingTareWeight(weight);
        toast.success('✅ TARE weight recorded! Vehicle can now proceed for loading.');
      }
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to capture weight');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureSecondWeight = async () => {
    if (!secondWeightValue.trim()) {
      toast.error('Please enter weight');
      return;
    }

    const weight = parseFloat(secondWeightValue);
    if (weight <= 0) {
      toast.error('Weight must be greater than 0');
      return;
    }

    // Validate weight relationship
    if (transactionType === 'purchase') {
      // For purchase: TARE must be less than GROSS
      if (weight >= existingGrossWeight) {
        toast.error(`TARE weight (${weight} kg) must be less than GROSS weight (${existingGrossWeight} kg)`);
        return;
      }
    } else {
      // For sales: GROSS must be greater than TARE
      if (weight <= existingTareWeight) {
        toast.error(`GROSS weight (${weight} kg) must be greater than TARE weight (${existingTareWeight} kg)`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        slip_id: slipId,
        vehicle_number: vehicleNumber.toUpperCase(),
        vehicle_type: vehicleType,
        driver_name: driverName || null,
        driver_mobile: driverMobile || null,
        weight: weight,
        weight_type: transactionType === 'purchase' ? 'tare' : 'gross',
        operator_id: user.id,
        operator_name: user.name,
        shift: shift
      };

      const response = await axios.post(`${API}/weighbridge-entry`, payload);
      
      setSecondWeightCaptured(true);
      
      if (transactionType === 'purchase') {
        setExistingTareWeight(weight);
        const netWeight = existingGrossWeight - weight;
        toast.success(`✅ TARE weight recorded! Net weight: ${netWeight.toFixed(2)} kg. Ready for ${preEntry.transaction_type === 'bill_purchase' ? 'Bill Purchase' : 'Farmer Payment'}!`);
      } else {
        setExistingGrossWeight(weight);
        const netWeight = weight - existingTareWeight;
        toast.success(`✅ GROSS weight recorded! Net weight: ${netWeight.toFixed(2)} kg. Ready for Sales Invoice!`);
      }
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to capture weight');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSlipId('');
    setPreEntry(null);
    setTransactionType(null);
    setVehicleNumber('');
    setVehicleType('Truck');
    setDriverName('');
    setDriverMobile('');
    setFirstWeightValue('');
    setSecondWeightValue('');
    setFirstWeightCaptured(false);
    setSecondWeightCaptured(false);
    setExistingTareWeight(null);
    setExistingGrossWeight(null);
    setNetWeight(0);
    setBags(0);
    setQuintals(0);
    setShowWeightCapture(false);
    fetchQueue(); // Refresh queue after reset
  };

  // Helper function to get weight labels
  const getWeightLabels = () => {
    if (transactionType === 'purchase') {
      return {
        first: { label: 'GROSS Weight', emoji: '🚛', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300' },
        second: { label: 'TARE Weight', emoji: '🚚', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' }
      };
    } else {
      return {
        first: { label: 'TARE Weight', emoji: '🚚', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' },
        second: { label: 'GROSS Weight', emoji: '🚛', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300' }
      };
    }
  };

  const weightLabels = preEntry ? getWeightLabels() : null;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold" style={{color: '#3E2723'}}>⚖️ Weighbridge Entry</h1>
          {showWeightCapture && (
            <Button onClick={resetForm} variant="outline">
              ← Back to Queue
            </Button>
          )}
        </div>

        {/* Queue Display */}
        {!showWeightCapture && (
          <>
            <Card className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{color: '#3E2723'}}>📋 Pending Weighbridge Entries</h2>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="farmer_purchase">Farmer Purchase</SelectItem>
                      <SelectItem value="bill_purchase">Bill Purchase</SelectItem>
                      <SelectItem value="sale">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchQueue} variant="outline">
                    🔄 Refresh
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading queue...</div>
              ) : queue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">📭 No pending entries</p>
                  <p className="text-sm">All weighbridge entries are complete!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b" style={{backgroundColor: '#F5F5F5'}}>
                        <th className="text-left p-3 font-semibold">Slip ID</th>
                        <th className="text-left p-3 font-semibold">Type</th>
                        <th className="text-left p-3 font-semibold">Party/Customer</th>
                        <th className="text-left p-3 font-semibold">Item</th>
                        <th className="text-left p-3 font-semibold">Vehicle</th>
                        <th className="text-center p-3 font-semibold">Weights (kg)</th>
                        <th className="text-center p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((item) => (
                        <tr key={item.pre_entry_id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-bold text-blue-700">{item.slip_id}</div>
                            <div className="text-xs text-gray-500">{item.date}</div>
                          </td>
                          <td className="p-3">
                            <Badge style={{
                              backgroundColor: 
                                item.transaction_type === 'sale' ? '#1976D2' : 
                                item.transaction_type === 'bill_purchase' ? '#F57C00' : '#388E3C',
                              color: 'white'
                            }}>
                              {item.transaction_type === 'farmer_purchase' ? '🚜 Farmer' : 
                               item.transaction_type === 'bill_purchase' ? '📦 Bill' : '🚚 Sale'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{item.party_name}</div>
                            {item.party_mobile && (
                              <div className="text-xs text-gray-500">{item.party_mobile}</div>
                            )}
                          </td>
                          <td className="p-3 text-sm">{item.item_name || 'N/A'}</td>
                          <td className="p-3 text-sm">{item.vehicle_number || '-'}</td>
                          <td className="p-3">
                            <div className="text-center text-sm">
                              <div>Gross: <span className="font-semibold text-green-700">{item.gross_weight || '-'}</span></div>
                              <div>Tare: <span className="font-semibold text-blue-700">{item.tare_weight || '-'}</span></div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                disabled={!item.tare_pending}
                                onClick={() => handleProcessEntry(item, 'tare')}
                                style={{
                                  backgroundColor: item.tare_pending ? '#2196F3' : '#E0E0E0',
                                  color: item.tare_pending ? 'white' : '#9E9E9E',
                                  cursor: item.tare_pending ? 'pointer' : 'not-allowed'
                                }}
                              >
                                🚚 TARE
                              </Button>
                              <Button
                                size="sm"
                                disabled={!item.gross_pending}
                                onClick={() => handleProcessEntry(item, 'gross')}
                                style={{
                                  backgroundColor: item.gross_pending ? '#4CAF50' : '#E0E0E0',
                                  color: item.gross_pending ? 'white' : '#9E9E9E',
                                  cursor: item.gross_pending ? 'pointer' : 'not-allowed'
                                }}
                              >
                                🚛 GROSS
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Weight Capture Section - Only shown when processing an entry */}
        {showWeightCapture && preEntry && (
          <>
            {/* Header: Transaction Overview */}
            <Card className="p-6 mb-6" style={{backgroundColor: '#FFF8E1', borderColor: '#F57C00', borderWidth: 2}}>
              <h2 className="text-lg font-bold mb-3" style={{color: '#E65100'}}>📋 TRANSACTION OVERVIEW</h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Slip ID</p>
                  <p className="font-bold text-lg">{preEntry.slip_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Party/Customer</p>
                  <p className="font-bold text-lg">{preEntry.party_name || preEntry.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Item</p>
                  <p className="font-bold text-lg">{preEntry.item_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Transaction Type</p>
                  <Badge className="text-sm" style={{backgroundColor: transactionType === 'sale' ? '#1976D2' : '#388E3C', color: 'white'}}>
                    {transactionType === 'sale' ? '🚚 SALE' : '📦 PURCHASE'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Visual Flow Indicator */}
            <Card className="p-4 mb-6" style={{backgroundColor: '#F5F5F5'}}>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className={`text-3xl mb-1 ${firstWeightCaptured ? '' : 'opacity-40'}`}>
                    {weightLabels.first.emoji}
                  </div>
                  <div className={`font-bold ${weightLabels.first.color}`}>{weightLabels.first.label}</div>
                  <div className="text-2xl mt-1">
                    {firstWeightCaptured ? '✅' : '⏳'}
                  </div>
                </div>
                
                <div className="text-4xl text-gray-400">→</div>
                
                <div className="text-center">
                  <div className={`text-3xl mb-1 ${secondWeightCaptured ? '' : 'opacity-40'}`}>
                    {weightLabels.second.emoji}
                  </div>
                  <div className={`font-bold ${weightLabels.second.color}`}>{weightLabels.second.label}</div>
                  <div className="text-2xl mt-1">
                    {secondWeightCaptured ? '✅' : firstWeightCaptured ? '⏳' : '🔒'}
                  </div>
                </div>
                
                <div className="text-4xl text-gray-400">=</div>
                
                <div className="text-center">
                  <div className={`text-3xl mb-1 ${secondWeightCaptured ? '' : 'opacity-40'}`}>🎯</div>
                  <div className="font-bold text-orange-700">NET Weight</div>
                  <div className="text-2xl mt-1">
                    {secondWeightCaptured ? '✅' : '🔒'}
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 1: Vehicle Details */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>🚗 VEHICLE DETAILS</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-semibold">
                    Vehicle Number *
                    {firstWeightCaptured && (
                      <span className="ml-2 text-xs text-green-600">🔒 Locked</span>
                    )}
                  </Label>
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="MP09AB1234"
                    className="mt-1"
                    required
                    disabled={firstWeightCaptured}
                    style={firstWeightCaptured ? {backgroundColor: '#f0f0f0'} : {}}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Vehicle Type *</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType} disabled={firstWeightCaptured}>
                    <SelectTrigger className="mt-1" style={firstWeightCaptured ? {backgroundColor: '#f0f0f0'} : {}}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Truck">Truck</SelectItem>
                      <SelectItem value="Tractor">Tractor</SelectItem>
                      <SelectItem value="Hammali">Hammali</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Driver Name</Label>
                  <Input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Optional"
                    className="mt-1"
                    disabled={firstWeightCaptured}
                    style={firstWeightCaptured ? {backgroundColor: '#f0f0f0'} : {}}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Driver Mobile</Label>
                  <Input
                    value={driverMobile}
                    onChange={(e) => setDriverMobile(e.target.value)}
                    placeholder="Optional"
                    className="mt-1"
                    disabled={firstWeightCaptured}
                    style={firstWeightCaptured ? {backgroundColor: '#f0f0f0'} : {}}
                  />
                </div>
              </div>
            </Card>

            {/* Section 2: Weight Capture Flow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              
              {/* Card 1: First Weight */}
              <Card 
                className={`p-6 border-2 ${firstWeightCaptured ? weightLabels.first.bg : 'bg-white'}`}
                style={{borderColor: firstWeightCaptured ? '#4CAF50' : weightLabels.first.border.includes('blue') ? '#2196F3' : '#4CAF50'}}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-bold ${weightLabels.first.color}`}>
                    1️⃣ {weightLabels.first.label}
                  </h3>
                  <Badge style={{backgroundColor: firstWeightCaptured ? '#4CAF50' : '#FFC107', color: 'white'}}>
                    {firstWeightCaptured ? '✅ Done' : '⏳ Current'}
                  </Badge>
                </div>

                {firstWeightCaptured ? (
                  <div className="space-y-3">
                    <div className="text-center py-6">
                      <div className="text-5xl font-bold" style={{color: '#2E7D32'}}>
                        {transactionType === 'purchase' 
                          ? existingGrossWeight.toFixed(2)
                          : existingTareWeight.toFixed(2)
                        } kg
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="inline-block px-4 py-2 bg-gray-200 rounded text-sm">
                        📸 Photo Captured
                      </div>
                    </div>
                    {!secondWeightCaptured && (
                      <div className="mt-4">
                        <Button 
                          className="w-full"
                          style={{
                            backgroundColor: transactionType === 'purchase' ? '#FF9800' : '#2196F3',
                            color: 'white'
                          }}
                          onClick={() => {
                            toast.success(transactionType === 'purchase' 
                              ? '📦 Vehicle proceeding to unloading area. Return with slip for TARE weight after unloading.' 
                              : '📦 Vehicle proceeding to loading area. Return with slip for GROSS weight after loading.'
                            );
                            resetForm();
                          }}
                        >
                          {transactionType === 'purchase' ? '📦 Proceed to Unloading' : '📦 Proceed to Loading'}
                        </Button>
                        <p className="text-xs text-center text-gray-600 mt-2">
                          {transactionType === 'purchase' 
                            ? 'Return after unloading to capture TARE weight'
                            : 'Return after loading to capture GROSS weight'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">
                        {transactionType === 'purchase' ? 'GROSS Weight (kg) *' : 'TARE Weight (kg) *'}
                      </Label>
                      <Input
                        type="number"
                        value={firstWeightValue}
                        onChange={(e) => setFirstWeightValue(e.target.value)}
                        placeholder={transactionType === 'purchase' ? 'Enter loaded weight' : 'Enter empty weight'}
                        className="mt-1 text-xl font-bold"
                        min="0"
                      />
                    </div>
                    <Button 
                      onClick={handleCaptureFirstWeight}
                      disabled={loading}
                      className="w-full"
                      style={{backgroundColor: '#1976D2', color: 'white'}}
                    >
                      {loading ? 'Capturing...' : '📸 Capture Weight'}
                    </Button>
                  </div>
                )}
              </Card>

              {/* Card 2: Second Weight */}
              <Card 
                className={`p-6 border-2 ${secondWeightCaptured ? weightLabels.second.bg : 'bg-white'} ${!firstWeightCaptured || (transactionType === 'purchase' && firstWeightCaptured) ? 'opacity-50' : ''}`}
                style={{borderColor: secondWeightCaptured ? '#4CAF50' : weightLabels.second.border.includes('blue') ? '#2196F3' : '#4CAF50'}}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-bold ${weightLabels.second.color}`}>
                    2️⃣ {weightLabels.second.label}
                  </h3>
                  <Badge style={{backgroundColor: secondWeightCaptured ? '#4CAF50' : (!firstWeightCaptured ? '#9E9E9E' : '#FFC107'), color: 'white'}}>
                    {secondWeightCaptured ? '✅ Done' : (!firstWeightCaptured ? '🔒 Locked' : '⏳ Current')}
                  </Badge>
                </div>

                {secondWeightCaptured ? (
                  <div className="space-y-3">
                    <div className="text-center py-6">
                      <div className="text-5xl font-bold" style={{color: '#2E7D32'}}>
                        {transactionType === 'purchase' 
                          ? existingTareWeight?.toFixed(2) 
                          : existingGrossWeight?.toFixed(2)
                        } kg
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="inline-block px-4 py-2 bg-gray-200 rounded text-sm">
                        📸 Photo Captured
                      </div>
                    </div>
                    <div className="text-center text-sm text-green-600 mt-2 font-semibold">
                      ✅ Ready for {transactionType === 'purchase' ? (preEntry.transaction_type === 'bill_purchase' ? 'Bill Purchase' : 'Farmer Payment') : 'Sales Invoice'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {firstWeightCaptured ? (
                      <>
                        <div>
                          <Label className="text-sm font-semibold">
                            {transactionType === 'purchase' ? 'TARE Weight (kg) *' : 'GROSS Weight (kg) *'}
                          </Label>
                          <Input
                            type="number"
                            value={secondWeightValue}
                            onChange={(e) => setSecondWeightValue(e.target.value)}
                            placeholder={transactionType === 'purchase' ? 'Enter empty weight' : 'Enter loaded weight'}
                            className="mt-1 text-xl font-bold"
                            min="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {transactionType === 'purchase' 
                              ? `Must be < ${existingGrossWeight} kg (GROSS)`
                              : `Must be > ${existingTareWeight} kg (TARE)`
                            }
                          </p>
                        </div>
                        <Button 
                          onClick={handleCaptureSecondWeight}
                          disabled={loading}
                          className="w-full"
                          style={{backgroundColor: '#388E3C', color: 'white'}}
                        >
                          {loading ? 'Capturing...' : '📸 Capture Weight'}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-4xl mb-2">🔒</div>
                        <p className="text-sm">Complete first weight to unlock</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Card 3: Net Weight */}
              <Card 
                className={`p-6 border-2 ${(secondWeightCaptured || (transactionType === 'purchase' && firstWeightCaptured)) ? 'bg-orange-50' : 'bg-white opacity-50'}`}
                style={{borderColor: (secondWeightCaptured || (transactionType === 'purchase' && firstWeightCaptured)) ? '#FF9800' : '#E0E0E0'}}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-orange-700">
                    3️⃣ NET Weight
                  </h3>
                  <Badge style={{backgroundColor: (secondWeightCaptured || (transactionType === 'purchase' && firstWeightCaptured)) ? '#FF9800' : '#9E9E9E', color: 'white'}}>
                    {(secondWeightCaptured || (transactionType === 'purchase' && firstWeightCaptured)) ? '🎯 Result' : '🔒 Locked'}
                  </Badge>
                </div>

                {(secondWeightCaptured || (transactionType === 'purchase' && firstWeightCaptured)) ? (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="text-6xl font-bold text-orange-600">
                        {netWeight.toFixed(2)}
                      </div>
                      <div className="text-xl font-semibold text-gray-700 mt-2">kg</div>
                    </div>
                    
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Bags (100kg):</span>
                        <span className="font-bold">{bags}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Quintals:</span>
                        <span className="font-bold">{quintals}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Remaining kg:</span>
                        <span className="font-bold">{(netWeight % 100).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-orange-100 p-3 rounded text-xs text-center">
                      <p className="font-semibold text-orange-800">Formula:</p>
                      <p className="text-gray-700">
                        {transactionType === 'purchase' 
                          ? `${parseFloat(firstWeightValue).toFixed(2)} (GROSS) - ${parseFloat(secondWeightValue).toFixed(2)} (TARE)`
                          : `${existingGrossWeight?.toFixed(2) || parseFloat(secondWeightValue).toFixed(2)} (GROSS) - ${existingTareWeight?.toFixed(2) || parseFloat(firstWeightValue).toFixed(2)} (TARE)`
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-5xl mb-3">🎯</div>
                    <p className="text-sm">Complete both weighments</p>
                    <p className="text-sm">to see net weight</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Contextual Message */}
            {secondWeightCaptured && (
              <Card className="p-4 mb-6" style={{backgroundColor: '#E8F5E9', borderColor: '#4CAF50', borderWidth: 2}}>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">✅</div>
                  <div>
                    <p className="font-bold text-green-800">Weighbridge Entry Completed!</p>
                    <p className="text-sm text-green-700">
                      Net weight: {netWeight.toFixed(2)} kg ({bags} bags + {(netWeight % 100).toFixed(2)} kg) calculated. 
                      Entry ready for {transactionType === 'purchase' 
                        ? (preEntry.transaction_type === 'bill_purchase' ? 'Bill Purchase' : 'Farmer Payment')
                        : 'Sales Invoice'
                      } processing.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default WeighbridgeEntryPage;
