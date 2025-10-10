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

function FarmerPaymentPage({ user, onLogout }) {
  // View state: 'queue' or 'form'
  const [view, setView] = useState('queue');
  
  // Queue state
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  
  // Form state (existing farmer payment form)
  const [bookNo, setBookNo] = useState('');
  const [location, setLocation] = useState('Sanawad');
  const [contractType, setContractType] = useState('Anubandh');
  const [mandiGodown, setMandiGodown] = useState('Mandi');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [gateEntryNo, setGateEntryNo] = useState('');
  
  const [farmerName, setFarmerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [tokenNo, setTokenNo] = useState('');
  
  const [items, setItems] = useState([]);
  const [lines, setLines] = useState([{
    itemId: '', itemName: '', packKg: 100, bags: 0, remKg: 0,
    actKg: 0, actQtl: 0, ratePerQtl: 0, itemAmount: 0,
    vehicleType: 'Truck', hPlusT: 0, lineTotal: 0, sortOrder: 0
  }]);
  
  const [payType, setPayType] = useState('Cash');
  const [cashAmt, setCashAmt] = useState(0);
  const [bankAmt, setBankAmt] = useState(0);
  const [additionalHamli, setAdditionalHamli] = useState(0);
  const [bankCharges, setBankCharges] = useState(0);
  
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [slipData, setSlipData] = useState(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [savedPayment, setSavedPayment] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (view === 'queue') {
      fetchQueue();
    } else {
      fetchItems();
      fetchBookNumber();
    }
  }, [view, searchQuery, dateFilter]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (dateFilter !== 'all') params.append('date_filter', dateFilter);
      params.append('sort_by', sortBy);
      
      const response = await axios.get(`${API}/farmer-payment/queue?${params.toString()}`);
      setQueue(response.data);
    } catch (error) {
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API}/items`);
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load items');
    }
  };

  const fetchBookNumber = async () => {
    try {
      const response = await axios.get(`${API}/book-number-next?location=${location}`);
      setBookNo(response.data.book_no);
    } catch (error) {
      console.error('Failed to fetch book number');
    }
  };

  const handleProcessPayment = async (slipId) => {
    // Fetch weighbridge entry and switch to form view
    try {
      const response = await axios.get(`${API}/weighbridge-entry/${slipId}`);
      setSlipData(response.data);
      setGateEntryNo(slipId);
      setView('form');
      
      // Auto-fill form
      autoFillFromSlip(response.data);
      
    } catch (error) {
      toast.error('Failed to load slip data');
    }
  };

  const autoFillFromSlip = (data) => {
    setFarmerName(data.party_name || '');
    setMobile(data.party_mobile || '');
    setCity(data.city || '');
    setTokenNo(data.token_no || '');
    
    // Auto-fill first line item
    const newLines = [...lines];
    newLines[0] = {
      ...newLines[0],
      itemId: data.item_id || '',
      itemName: data.item_name || '',
      bags: data.bags || 0,
      remKg: data.rem_kg || 0,
      actKg: data.net_weight || 0,
      actQtl: data.act_qtl || 0,
      ratePerQtl: data.rate_per_qtl || 0,
      vehicleType: data.vehicle_type || 'Truck'
    };
    
    // Calculate H+T and totals
    calculateLineTotal(0, newLines);
    setLines(newLines);
  };

  const calculateLineTotal = (index, currentLines) => {
    const line = currentLines[index];
    const itemAmount = line.ratePerQtl * line.actQtl;
    
    // H+T calculation
    let hPlusTRate = 0;
    if (line.vehicleType === 'Truck') hPlusTRate = 4.75;
    else if (line.vehicleType === 'Hammali') hPlusTRate = 5.75;
    
    const hPlusT = hPlusTRate * line.actQtl;
    const lineTotal = itemAmount - hPlusT;
    
    currentLines[index] = {
      ...line,
      itemAmount: Math.round(itemAmount),
      hPlusT: Math.round(hPlusT),
      lineTotal: Math.round(lineTotal)
    };
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!farmerName || !mobile || lines.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0) - additionalHamli - bankCharges;
      
      const payload = {
        location,
        contract_type: contractType,
        mandi_godown: mandiGodown,
        date,
        gate_entry_no: gateEntryNo,
        farmer_name: farmerName,
        mobile,
        city,
        token_no: tokenNo,
        lines: lines.map((line, idx) => ({
          ...line,
          item_id: line.itemId,
          item_name: line.itemName,
          pack_kg: line.packKg,
          rem_kg: line.remKg,
          act_kg: line.actKg,
          act_qtl: line.actQtl,
          rate_per_qtl: line.ratePerQtl,
          item_amount: line.itemAmount,
          vehicle_type: line.vehicleType,
          h_plus_t: line.hPlusT,
          line_total: line.lineTotal,
          sort_order: idx
        })),
        pay_type: payType,
        cash_amt: payType === 'Cash' ? totalAmount : cashAmt,
        bank_amt: payType === 'Bank' ? totalAmount : bankAmt,
        additional_hamli: additionalHamli,
        bank_charges: bankCharges,
        created_by: user.id
      };

      const response = await axios.post(`${API}/farmer-payment`, payload);
      
      toast.success('Farmer payment saved successfully! Vouchers generated.');
      
      // Show success modal with print option
      setSavedPayment(response.data);
      setShowSuccessModal(true);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save payment');
    }
  };

  const resetForm = () => {
    setGateEntryNo('');
    setFarmerName('');
    setMobile('');
    setCity('');
    setTokenNo('');
    setLines([{
      itemId: '', itemName: '', packKg: 100, bags: 0, remKg: 0,
      actKg: 0, actQtl: 0, ratePerQtl: 0, itemAmount: 0,
      vehicleType: 'Truck', hPlusT: 0, lineTotal: 0, sortOrder: 0
    }]);
    setCashAmt(0);
    setBankAmt(0);
    setAdditionalHamli(0);
    setBankCharges(0);
    setSlipData(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && view === 'queue') {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  // ========== QUEUE VIEW ==========
  if (view === 'queue') {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Farmer Payment Queue</h1>
              <p className="text-lg" style={{color: '#6B5846'}}>Process pending payments</p>
            </div>
            
            <Button 
              onClick={() => setShowManualEntry(true)} 
              className="btn-secondary"
            >
              📝 Manual Entry
            </Button>
          </div>

          {/* Search & Filters */}
          <Card className="p-4 mb-6">
            <div className="flex space-x-4 items-end">
              <div className="flex-1">
                <Label className="text-sm font-semibold">🔍 Search</Label>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Slip ID, Farmer Name, or Mobile..."
                  className="mt-1"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={() => setDateFilter('all')}
                  className={dateFilter === 'all' ? 'btn-primary' : 'btn-secondary'}
                >
                  All
                </Button>
                <Button 
                  onClick={() => setDateFilter('today')}
                  className={dateFilter === 'today' ? 'btn-primary' : 'btn-secondary'}
                >
                  Today
                </Button>
                <Button 
                  onClick={() => setDateFilter('yesterday')}
                  className={dateFilter === 'yesterday' ? 'btn-primary' : 'btn-secondary'}
                >
                  Yesterday
                </Button>
                <Button 
                  onClick={() => setDateFilter('this_week')}
                  className={dateFilter === 'this_week' ? 'btn-primary' : 'btn-secondary'}
                >
                  This Week
                </Button>
              </div>
            </div>
          </Card>

          {/* Queue Cards */}
          {queue.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2" style={{color: '#3E2723'}}>All Payments Completed!</h2>
              <p style={{color: '#6B5846'}}>No pending farmer payments at the moment.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {queue.map(item => (
                <Card key={item.slip_id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Slip ID</p>
                        <p className="text-xl font-bold" style={{color: '#6B8E23'}}>{item.slip_id}</p>
                        <p className="text-sm mt-1">{formatDateTime(item.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Farmer</p>
                        <p className="font-bold">{item.farmer_name}</p>
                        <p className="text-sm">{item.farmer_mobile}</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Item & Quantity</p>
                        <p className="font-bold">{item.item_name}</p>
                        <p className="text-sm">{item.act_qtl} qtl | {item.vehicle_type}</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Estimated Amount</p>
                        <p className="text-xl font-bold" style={{color: '#D4AF37'}}>
                          {formatCurrency(item.estimated_amount)}
                        </p>
                        <p className="text-xs">@ ₹{item.rate_per_qtl}/qtl</p>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => handleProcessPayment(item.slip_id)}
                      className="btn-primary ml-6"
                    >
                      Process →
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Manual Entry Dialog */}
          <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Slip ID / Gate Entry No</Label>
                  <Input
                    value={gateEntryNo}
                    onChange={(e) => setGateEntryNo(e.target.value)}
                    placeholder="WB-25-000001"
                    className="mt-1"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => setShowManualEntry(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (gateEntryNo) {
                        handleProcessPayment(gateEntryNo);
                        setShowManualEntry(false);
                      } else {
                        toast.error('Please enter Slip ID');
                      }
                    }}
                    className="btn-primary flex-1"
                  >
                    Fetch & Process
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  // ========== FORM VIEW (Existing Payment Form) ==========
  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0) - additionalHamli - bankCharges;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        {/* Header with Back Button */}
        <div className="flex items-center mb-8">
          <Button 
            onClick={() => {
              resetForm();
              setView('queue');
            }}
            className="btn-secondary mr-4"
          >
            ← Back to Queue
          </Button>
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Process Payment</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Book No: {bookNo}</p>
          </div>
        </div>

        {/* Rest of the existing payment form... */}
        <form onSubmit={handleSavePayment} className="space-y-6">
          {/* Farmer Details Section */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Farmer Details</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Farmer Name *</Label>
                <Input value={farmerName} onChange={(e) => setFarmerName(e.target.value)} required />
              </div>
              <div>
                <Label>Mobile *</Label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} required />
              </div>
              <div>
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label>Token No</Label>
                <Input value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} />
              </div>
            </div>
          </Card>

          {/* Line Items Summary */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Items</h2>
            {lines.map((line, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded mb-2">
                <p><strong>Item:</strong> {line.itemName || 'Not selected'}</p>
                <p><strong>Quantity:</strong> {line.actQtl} qtl ({line.bags} bags + {line.remKg} kg)</p>
                <p><strong>Rate:</strong> ₹{line.ratePerQtl}/qtl | <strong>Vehicle:</strong> {line.vehicleType}</p>
                <p><strong>Amount:</strong> {formatCurrency(line.itemAmount)} | <strong>H+T:</strong> {formatCurrency(line.hPlusT)} | <strong>Total:</strong> {formatCurrency(line.lineTotal)}</p>
              </div>
            ))}
          </Card>

          {/* Payment Details */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Payment Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pay Type</Label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)} className="erp-select">
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={payType === 'Cash' ? totalAmount : (payType === 'Bank' ? totalAmount : 0)} readOnly />
              </div>
            </div>
          </Card>

          {/* Total Amount Display */}
          <Card className="p-6" style={{background: 'linear-gradient(135deg, rgba(107, 142, 35, 0.1) 0%, rgba(212, 175, 55, 0.1) 100%)'}}>
            <div className="text-center">
              <p className="text-lg mb-2" style={{color: '#6B5846'}}>Total Amount</p>
              <p className="text-5xl font-bold" style={{color: '#6B8E23'}}>{formatCurrency(totalAmount)}</p>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" className="btn-primary px-12 py-4 text-lg">
              💾 Save Payment
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default FarmerPaymentPage;
