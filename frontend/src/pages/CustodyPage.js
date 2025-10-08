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

function CustodyPage({ user, onLogout }) {
  const [lots, setLots] = useState([]);
  const [weighbridgeSlips, setWeighbridgeSlips] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPledgeDialog, setShowPledgeDialog] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);

  // Form state
  const [weighbridgeSlipId, setWeighbridgeSlipId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [pledgePercentage, setPledgePercentage] = useState('70');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lotsRes, slipsRes, partiesRes, itemsRes] = await Promise.all([
        axios.get(`${API}/custody/lots`),
        axios.get(`${API}/weighbridge/slips`),
        axios.get(`${API}/parties`),
        axios.get(`${API}/items`)
      ]);
      
      setLots(lotsRes.data);
      // Filter only weighed slips
      setWeighbridgeSlips(slipsRes.data.filter(s => s.status === 'weighed'));
      setParties(partiesRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLot = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/custody/create`, {
        weighbridge_slip_id: weighbridgeSlipId,
        party_id: partyId,
        item_id: itemId,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate)
      });
      
      toast.success('Custody lot created successfully!');
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create custody lot');
    }
  };

  const handlePledge = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/custody/pledge`, {
        custody_lot_id: selectedLot.id,
        pledge_percentage: parseFloat(pledgePercentage)
      });
      
      toast.success('Custody lot pledged successfully!');
      setShowPledgeDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pledge custody lot');
    }
  };

  const resetForm = () => {
    setWeighbridgeSlipId('');
    setPartyId('');
    setItemId('');
    setQuantity('');
    setRate('');
    setPledgePercentage('70');
  };

  const calculatePledgeAmount = () => {
    if (!selectedLot || !pledgePercentage) return 0;
    return (parseFloat(pledgePercentage) / 100) * selectedLot.total_value;
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
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Custody & Pledge</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Manage custody lots and funding</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-custody-lot-button">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Custody Lot
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Custody Lot</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLot} className="space-y-4">
                <div>
                  <Label htmlFor="wbSlip">Weighbridge Slip</Label>
                  <select
                    id="wbSlip"
                    data-testid="wb-slip-select"
                    value={weighbridgeSlipId}
                    onChange={(e) => {
                      const slip = weighbridgeSlips.find(s => s.id === e.target.value);
                      setWeighbridgeSlipId(e.target.value);
                      if (slip) {
                        setPartyId(slip.party_id);
                        setItemId(slip.item_id);
                        setQuantity(slip.net_weight?.toString() || '');
                      }
                    }}
                    className="erp-select"
                    required
                  >
                    <option value="">Select Weighbridge Slip</option>
                    {weighbridgeSlips.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.slip_number} - {s.vehicle_number} ({s.net_weight} kg)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="custodyParty">Party</Label>
                  <select
                    id="custodyParty"
                    data-testid="custody-party-select"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="erp-select"
                    required
                  >
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="custodyItem">Item</Label>
                  <select
                    id="custodyItem"
                    data-testid="custody-item-select"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="erp-select"
                    required
                  >
                    <option value="">Select Item</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity (kg)</Label>
                  <Input
                    id="quantity"
                    data-testid="quantity-input"
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rate">Rate per kg (₹)</Label>
                  <Input
                    id="rate"
                    data-testid="rate-input"
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    required
                  />
                </div>
                {quantity && rate && (
                  <div className="p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <p className="text-sm" style={{color: '#6B5846'}}>Total Value</p>
                    <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                      ₹{(parseFloat(quantity) * parseFloat(rate)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <Button type="submit" className="w-full btn-primary" data-testid="submit-custody-lot">
                  Create Custody Lot
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Custody Lots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lots.map(lot => (
            <Card key={lot.id} className="erp-card" data-testid={`custody-lot-${lot.lot_number}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1" style={{color: '#3E2723'}}>{lot.lot_number}</h3>
                  <span className={`badge ${
                    lot.status === 'active' ? 'badge-success' :
                    lot.status === 'margin_call' ? 'badge-danger' :
                    'badge-info'
                  }`}>
                    {lot.status}
                  </span>
                </div>
                {lot.current_ltv >= 75 && (
                  <svg className="w-6 h-6" style={{color: '#D32F2F'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-sm" style={{color: '#6B5846'}}>Party</p>
                  <p className="font-semibold" style={{color: '#3E2723'}}>{lot.party_name}</p>
                </div>
                <div>
                  <p className="text-sm" style={{color: '#6B5846'}}>Item</p>
                  <p className="font-semibold" style={{color: '#3E2723'}}>{lot.item_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Quantity</p>
                    <p className="font-semibold" style={{color: '#3E2723'}}>{lot.quantity} kg</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{color: '#6B5846'}}>Rate</p>
                    <p className="font-semibold" style={{color: '#3E2723'}}>₹{lot.rate}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm" style={{color: '#6B5846'}}>Total Value</p>
                  <p className="text-xl font-bold" style={{color: '#6B8E23'}}>
                    ₹{lot.total_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {lot.pledged && (
                <div className="p-4 rounded-lg mb-4" style={{background: 'rgba(218, 165, 32, 0.1)'}}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm" style={{color: '#6B5846'}}>Pledged</p>
                      <p className="font-bold" style={{color: '#DAA520'}}>
                        ₹{lot.pledge_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{color: '#6B5846'}}>LTV</p>
                      <p className="font-bold" style={{
                        color: lot.current_ltv >= 80 ? '#D32F2F' : lot.current_ltv >= 75 ? '#F57C00' : '#6B8E23'
                      }}>
                        {lot.current_ltv.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 rounded-full" style={{background: 'rgba(0,0,0,0.1)'}}>
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(lot.current_ltv, 100)}%`,
                          background: lot.current_ltv >= 80 ? '#D32F2F' : lot.current_ltv >= 75 ? '#F57C00' : '#6B8E23'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!lot.pledged && lot.status === 'active' && (
                <Button 
                  onClick={() => {
                    setSelectedLot(lot);
                    setShowPledgeDialog(true);
                  }}
                  className="w-full btn-secondary"
                  data-testid={`pledge-button-${lot.lot_number}`}
                >
                  Pledge for Funding
                </Button>
              )}
            </Card>
          ))}
        </div>

        {/* Pledge Dialog */}
        <Dialog open={showPledgeDialog} onOpenChange={setShowPledgeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pledge Custody Lot</DialogTitle>
            </DialogHeader>
            {selectedLot && (
              <form onSubmit={handlePledge} className="space-y-4">
                <div className="p-4 rounded-lg" style={{background: '#F5E6D3'}}>
                  <p className="text-sm" style={{color: '#6B5846'}}>Lot Number</p>
                  <p className="font-bold text-lg mb-2" style={{color: '#3E2723'}}>{selectedLot.lot_number}</p>
                  <p className="text-sm" style={{color: '#6B5846'}}>Total Value</p>
                  <p className="font-bold text-xl" style={{color: '#6B8E23'}}>
                    ₹{selectedLot.total_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div>
                  <Label htmlFor="pledgePercentage">Pledge Percentage (Max 70%)</Label>
                  <Input
                    id="pledgePercentage"
                    data-testid="pledge-percentage-input"
                    type="number"
                    min="1"
                    max="70"
                    step="0.1"
                    value={pledgePercentage}
                    onChange={(e) => setPledgePercentage(e.target.value)}
                    required
                  />
                </div>

                <div className="p-4 rounded-lg" style={{background: 'rgba(218, 165, 32, 0.1)'}}>
                  <p className="text-sm" style={{color: '#6B5846'}}>Pledge Amount</p>
                  <p className="text-2xl font-bold" style={{color: '#DAA520'}}>
                    ₹{calculatePledgeAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>

                <Button type="submit" className="w-full btn-primary" data-testid="submit-pledge">
                  Confirm Pledge
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default CustodyPage;