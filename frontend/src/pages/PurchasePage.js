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

function PurchasePage({ user, onLogout }) {
  const [purchases, setPurchases] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [purchaseType, setPurchaseType] = useState('farmer');
  const [partyId, setPartyId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [ePermit, setEPermit] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [purchasesRes, partiesRes, itemsRes] = await Promise.all([
        axios.get(`${API}/purchases`),
        axios.get(`${API}/parties`),
        axios.get(`${API}/items`)
      ]);
      
      setPurchases(purchasesRes.data);
      setParties(partiesRes.data.filter(p => ['farmer', 'supplier'].includes(p.type)));
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/purchases`, {
        purchase_type: purchaseType,
        party_id: partyId,
        item_id: itemId,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate),
        payment_mode: paymentMode,
        payment_reference: paymentReference || null,
        e_permit: ePermit || null,
        created_by: user.id
      });
      
      toast.success('Purchase recorded successfully!');
      setShowCreateDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create purchase');
    }
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
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Purchases</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Farmer & Bill Purchases</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-purchase-button">
                Record Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Purchase</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreatePurchase} className="space-y-4">
                <div>
                  <Label>Purchase Type</Label>
                  <select value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)} className="erp-select">
                    <option value="farmer">Farmer Purchase</option>
                    <option value="bill">Bill Purchase</option>
                  </select>
                </div>
                <div>
                  <Label>Party</Label>
                  <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="erp-select" required>
                    <option value="">Select Party</option>
                    {parties.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div>
                  <Label>Item</Label>
                  <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="erp-select" required>
                    <option value="">Select Item</option>
                    {items.map(i => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantity (kg)</Label>
                    <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                  </div>
                  <div>
                    <Label>Rate (₹/kg)</Label>
                    <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="erp-select">
                    <option value="cash">Cash</option>
                    <option value="rtgs">RTGS</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <Label>Payment Reference</Label>
                  <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                </div>
                <div>
                  <Label>E-Permit (E-Anugya)</Label>
                  <Input value={ePermit} onChange={(e) => setEPermit(e.target.value)} />
                </div>
                {quantity && rate && (
                  <div className="p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <p className="text-sm" style={{color: '#6B5846'}}>Total Amount</p>
                    <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                      ₹{(parseFloat(quantity) * parseFloat(rate)).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
                <Button type="submit" className="w-full btn-primary">Record Purchase</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="erp-card">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Purchase History</h2>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Party</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>E-Permit</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td className="capitalize"><span className="badge badge-info">{p.purchase_type}</span></td>
                    <td>{p.party_name}</td>
                    <td>{p.item_name}</td>
                    <td>{p.quantity} kg</td>
                    <td>₹{p.rate}</td>
                    <td className="font-bold">₹{p.total_amount.toLocaleString('en-IN')}</td>
                    <td className="capitalize">{p.payment_mode || '-'}</td>
                    <td>{p.e_permit || '-'}</td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
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

export default PurchasePage;