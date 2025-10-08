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

function LedgerPage({ user, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [entryType, setEntryType] = useState('journal');
  const [partyId, setPartyId] = useState('');
  const [description, setDescription] = useState('');
  const [debitAmount, setDebitAmount] = useState('0');
  const [creditAmount, setCreditAmount] = useState('0');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entriesRes, partiesRes] = await Promise.all([
        axios.get(`${API}/ledger/entries`),
        axios.get(`${API}/parties`)
      ]);
      
      setEntries(entriesRes.data);
      setParties(partiesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/ledger/entry`, {
        entry_type: entryType,
        party_id: partyId || null,
        description,
        debit_amount: parseFloat(debitAmount),
        credit_amount: parseFloat(creditAmount),
        created_by: user.id
      });
      
      toast.success('Ledger entry created!');
      setShowCreateDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create entry');
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

  const totalDebit = entries.reduce((sum, e) => sum + e.debit_amount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit_amount, 0);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Ledger</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Accounting Entries</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-entry-button">
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Ledger Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEntry} className="space-y-4">
                <div>
                  <Label>Entry Type</Label>
                  <select value={entryType} onChange={(e) => setEntryType(e.target.value)} className="erp-select">
                    <option value="journal">Journal</option>
                    <option value="receipt">Receipt</option>
                    <option value="payment">Payment</option>
                    <option value="contra">Contra</option>
                  </select>
                </div>
                <div>
                  <Label>Party (Optional)</Label>
                  <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="erp-select">
                    <option value="">None</option>
                    {parties.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Debit Amount (₹)</Label>
                    <Input type="number" step="0.01" value={debitAmount} onChange={(e) => setDebitAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Credit Amount (₹)</Label>
                    <Input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-primary">Create Entry</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="erp-card">
            <p className="text-sm mb-2" style={{color: '#6B5846'}}>Total Debit</p>
            <p className="text-3xl font-bold" style={{color: '#D32F2F'}}>
              ₹{totalDebit.toLocaleString('en-IN')}
            </p>
          </Card>
          <Card className="erp-card">
            <p className="text-sm mb-2" style={{color: '#6B5846'}}>Total Credit</p>
            <p className="text-3xl font-bold" style={{color: '#6B8E23'}}>
              ₹{totalCredit.toLocaleString('en-IN')}
            </p>
          </Card>
        </div>

        <Card className="erp-card">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Ledger Entries</h2>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Party</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                    <td className="capitalize"><span className="badge badge-info">{entry.entry_type}</span></td>
                    <td>{entry.description}</td>
                    <td>{entry.party_id ? parties.find(p => p.id === entry.party_id)?.name || '-' : '-'}</td>
                    <td className="font-bold" style={{color: entry.debit_amount > 0 ? '#D32F2F' : '#6B5846'}}>
                      {entry.debit_amount > 0 ? `₹${entry.debit_amount.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="font-bold" style={{color: entry.credit_amount > 0 ? '#6B8E23' : '#6B5846'}}>
                      {entry.credit_amount > 0 ? `₹${entry.credit_amount.toLocaleString('en-IN')}` : '-'}
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

export default LedgerPage;