import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function WeighbridgePage({ user, onLogout }) {
  const [slips, setSlips] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showWeighDialog, setShowWeighDialog] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [searchSlip, setSearchSlip] = useState('');

  // Form state
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [partyId, setPartyId] = useState('');
  const [itemId, setItemId] = useState('');
  const [flowType, setFlowType] = useState('purchase');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [slipsRes, partiesRes, itemsRes] = await Promise.all([
        axios.get(`${API}/weighbridge/slips`),
        axios.get(`${API}/parties`),
        axios.get(`${API}/items`)
      ]);
      
      setSlips(slipsRes.data);
      setParties(partiesRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreEntry = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/weighbridge/pre-entry`, {
        vehicle_number: vehicleNumber,
        party_id: partyId,
        item_id: itemId,
        flow_type: flowType,
        created_by: user.id
      });
      
      toast.success('Pre-entry slip created successfully!');
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create pre-entry');
    }
  };

  const handleSearchSlip = async () => {
    if (!searchSlip) return;
    
    try {
      const response = await axios.get(`${API}/weighbridge/slip/${searchSlip}`);
      setSelectedSlip(response.data);
      setShowWeighDialog(true);
      setGrossWeight(response.data.gross_weight || '');
      setTareWeight(response.data.tare_weight || '');
    } catch (error) {
      toast.error('Slip not found');
    }
  };

  const handleUpdateWeights = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API}/weighbridge/weigh/${selectedSlip.slip_number}`, {
        gross_weight: parseFloat(grossWeight) || null,
        tare_weight: parseFloat(tareWeight) || null
      });
      
      toast.success('Weights updated successfully!');
      setShowWeighDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update weights');
    }
  };

  const resetForm = () => {
    setVehicleNumber('');
    setPartyId('');
    setItemId('');
    setFlowType('purchase');
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
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Weighbridge</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>QR-based weighbridge automation</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-pre-entry-button">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Pre-Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Weighbridge Pre-Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreatePreEntry} className="space-y-4">
                <div>
                  <Label htmlFor="vehicle">Vehicle Number</Label>
                  <Input
                    id="vehicle"
                    data-testid="vehicle-number-input"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="party">Party</Label>
                  <select
                    id="party"
                    data-testid="party-select"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="erp-select"
                    required
                  >
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="item">Item</Label>
                  <select
                    id="item"
                    data-testid="item-select"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="erp-select"
                    required
                  >
                    <option value="">Select Item</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.category})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="flowType">Flow Type</Label>
                  <select
                    id="flowType"
                    data-testid="flow-type-select"
                    value={flowType}
                    onChange={(e) => setFlowType(e.target.value)}
                    className="erp-select"
                  >
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                    <option value="custody">Custody</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <Button type="submit" className="w-full btn-primary" data-testid="submit-pre-entry">
                  Create Pre-Entry
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* QR Scan Section */}
        <Card className="erp-card mb-8">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Scan QR / Search Slip</h2>
          <div className="flex space-x-4">
            <Input
              data-testid="search-slip-input"
              placeholder="Enter slip number (e.g., WB000001)"
              value={searchSlip}
              onChange={(e) => setSearchSlip(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearchSlip} className="btn-primary" data-testid="search-slip-button">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </Button>
          </div>
        </Card>

        {/* Weighing Dialog */}
        <Dialog open={showWeighDialog} onOpenChange={setShowWeighDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Weighbridge Entry - {selectedSlip?.slip_number}</DialogTitle>
            </DialogHeader>
            {selectedSlip && (
              <div>
                {/* Slip Details */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg" style={{background: '#F5E6D3'}}>
                  <div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Vehicle Number</p>
                    <p className="font-bold" style={{color: '#3E2723'}}>{selectedSlip.vehicle_number}</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Party</p>
                    <p className="font-bold" style={{color: '#3E2723'}}>{selectedSlip.party_name}</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Item</p>
                    <p className="font-bold" style={{color: '#3E2723'}}>{selectedSlip.item_name}</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Flow Type</p>
                    <p className="font-bold capitalize" style={{color: '#3E2723'}}>{selectedSlip.flow_type}</p>
                  </div>
                </div>

                {/* QR Code Display */}
                <div className="mb-6 text-center">
                  <img src={selectedSlip.qr_code} alt="QR Code" className="mx-auto" style={{width: '200px', height: '200px'}} />
                </div>

                {/* Weight Entry Form */}
                <form onSubmit={handleUpdateWeights} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="grossWeight">Gross Weight (kg)</Label>
                      <Input
                        id="grossWeight"
                        data-testid="gross-weight-input"
                        type="number"
                        step="0.01"
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tareWeight">Tare Weight (kg)</Label>
                      <Input
                        id="tareWeight"
                        data-testid="tare-weight-input"
                        type="number"
                        step="0.01"
                        value={tareWeight}
                        onChange={(e) => setTareWeight(e.target.value)}
                      />
                    </div>
                  </div>
                  {grossWeight && tareWeight && (
                    <div className="p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                      <p className="text-sm" style={{color: '#6B5846'}}>Net Weight</p>
                      <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                        {(parseFloat(grossWeight) - parseFloat(tareWeight)).toFixed(2)} kg
                      </p>
                    </div>
                  )}
                  <Button type="submit" className="w-full btn-primary" data-testid="update-weights-button">
                    Update Weights
                  </Button>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Slips Table */}
        <Card className="erp-card">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Recent Weighbridge Slips</h2>
          <div className="overflow-x-auto">
            <table className="erp-table" data-testid="slips-table">
              <thead>
                <tr>
                  <th>Slip Number</th>
                  <th>Vehicle</th>
                  <th>Party</th>
                  <th>Item</th>
                  <th>Gross (kg)</th>
                  <th>Tare (kg)</th>
                  <th>Net (kg)</th>
                  <th>Flow Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {slips.map(slip => (
                  <tr key={slip.id} data-testid={`slip-row-${slip.slip_number}`}>
                    <td className="font-semibold" style={{color: '#6B8E23'}}>{slip.slip_number}</td>
                    <td>{slip.vehicle_number}</td>
                    <td>{slip.party_name}</td>
                    <td>{slip.item_name}</td>
                    <td>{slip.gross_weight?.toFixed(2) || '-'}</td>
                    <td>{slip.tare_weight?.toFixed(2) || '-'}</td>
                    <td className="font-bold">{slip.net_weight?.toFixed(2) || '-'}</td>
                    <td className="capitalize">{slip.flow_type}</td>
                    <td>
                      <span className={`badge ${
                        slip.status === 'completed' ? 'badge-success' :
                        slip.status === 'weighed' ? 'badge-info' :
                        'badge-warning'
                      }`}>
                        {slip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

export default WeighbridgePage;