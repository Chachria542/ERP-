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

function SalesPage({ user, onLogout }) {
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [partyId, setPartyId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [gstPercentage, setGstPercentage] = useState('5');
  const [tcsPercentage, setTcsPercentage] = useState('0.1');
  const [freight, setFreight] = useState('0');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, partiesRes, itemsRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/parties`),
        axios.get(`${API}/items`)
      ]);
      
      setSales(salesRes.data);
      setParties(partiesRes.data.filter(p => ['buyer', 'broker'].includes(p.type)));
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/sales`, {
        party_id: partyId,
        item_id: itemId,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate),
        gst_percentage: parseFloat(gstPercentage),
        tcs_percentage: parseFloat(tcsPercentage),
        freight: parseFloat(freight),
        created_by: user.id
      });
      
      toast.success('Sale invoice created successfully!');
      setShowCreateDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create sale');
    }
  };

  const calculateTotal = () => {
    if (!quantity || !rate) return { total: 0, gst: 0, tcs: 0, grand: 0 };
    const total = parseFloat(quantity) * parseFloat(rate);
    const gst = (parseFloat(gstPercentage) / 100) * total;
    const tcs = (parseFloat(tcsPercentage) / 100) * total;
    const grand = total + gst + tcs + parseFloat(freight || 0);
    return { total, gst, tcs, grand };
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

  const totals = calculateTotal();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Sales</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Orders & Invoices</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-sale-button">
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Sale Invoice</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSale} className="space-y-4">
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>GST %</Label>
                    <Input type="number" step="0.01" value={gstPercentage} onChange={(e) => setGstPercentage(e.target.value)} />
                  </div>
                  <div>
                    <Label>TCS %</Label>
                    <Input type="number" step="0.01" value={tcsPercentage} onChange={(e) => setTcsPercentage(e.target.value)} />
                  </div>
                  <div>
                    <Label>Freight (₹)</Label>
                    <Input type="number" step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} />
                  </div>
                </div>
                {quantity && rate && (
                  <div className="p-4 rounded-lg space-y-2" style={{background: 'rgba(107, 142, 35, 0.05)'}}>
                    <div className="flex justify-between text-sm">
                      <span style={{color: '#6B5846'}}>Subtotal:</span>
                      <span className="font-semibold">₹{totals.total.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{color: '#6B5846'}}>GST:</span>
                      <span className="font-semibold">₹{totals.gst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{color: '#6B5846'}}>TCS:</span>
                      <span className="font-semibold">₹{totals.tcs.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{color: '#6B5846'}}>Freight:</span>
                      <span className="font-semibold">₹{parseFloat(freight || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-bold" style={{color: '#3E2723'}}>Grand Total:</span>
                      <span className="text-xl font-bold" style={{color: '#6B8E23'}}>
                        ₹{totals.grand.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full btn-primary">Create Invoice</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="erp-card">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Sales Invoices</h2>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Party</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Subtotal</th>
                  <th>GST</th>
                  <th>TCS</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td className="font-semibold" style={{color: '#6B8E23'}}>{s.invoice_number}</td>
                    <td>{s.party_name}</td>
                    <td>{s.item_name}</td>
                    <td>{s.quantity} kg</td>
                    <td>₹{s.rate}</td>
                    <td>₹{s.total_amount.toLocaleString('en-IN')}</td>
                    <td>₹{s.gst_amount.toLocaleString('en-IN')}</td>
                    <td>₹{s.tcs_amount.toLocaleString('en-IN')}</td>
                    <td className="font-bold">₹{s.grand_total.toLocaleString('en-IN')}</td>
                    <td><span className="badge badge-warning">{s.status}</span></td>
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

export default SalesPage;