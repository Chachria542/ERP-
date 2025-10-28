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
  const [tulaiNo, setTulaiNo] = useState('');
  const [agrNo, setAgrNo] = useState('');
  
  const [farmerName, setFarmerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');  // Changed from city to village
  const [tokenNo, setTokenNo] = useState('');
  const [weighbridgeSlipNo, setWeighbridgeSlipNo] = useState('');
  
  const [items, setItems] = useState([]);
  const [lines, setLines] = useState([{
    itemId: '', itemName: '', packKg: 100, bags: 0, remKg: 0,
    actKg: 0, actQtl: 0, ratePerQtl: 0, itemAmount: 0,
    vehicleType: 'Truck', hPlusT: 0, lineTotal: 0, sortOrder: 0
  }]);
  
  const [payType, setPayType] = useState('Cash');
  const [cashBankAcId, setCashBankAcId] = useState('');
  const [cashAmt, setCashAmt] = useState(0);
  const [bankAmt, setBankAmt] = useState(0);
  const [additionalHamli, setAdditionalHamli] = useState(0);
  const [bankCharges, setBankCharges] = useState(0);
  
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [slipData, setSlipData] = useState(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [savedPayment, setSavedPayment] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

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
    // Fetch weighbridge entry and show photo approval modal
    try {
      const response = await axios.get(`${API}/weighbridge-entry/${slipId}`);
      setSlipData(response.data);
      setWeighbridgeSlipNo(slipId);
      
      // Show photo approval modal first
      setShowPhotoModal(true);
      
    } catch (error) {
      toast.error('Failed to load slip data');
    }
  };

  const handleApprovePhotos = async () => {
    try {
      // Update backend with approval
      await axios.put(`${API}/weighbridge-entry/${weighbridgeSlipNo}/photo-approval`, null, {
        params: {
          approved: true,
          user_id: user.id
        }
      });
      
      // Close modal and open payment form
      setShowPhotoModal(false);
      setView('form');
      
      // Auto-fill form
      autoFillFromSlip(slipData);
      
      toast.success('Photos approved. Processing payment...');
      
    } catch (error) {
      toast.error('Failed to approve photos');
    }
  };

  const handleRejectPhotos = () => {
    // Show rejection reason dialog
    setShowRejectionDialog(true);
  };

  const handleConfirmRejection = async () => {
    try {
      // Update backend with rejection
      await axios.put(`${API}/weighbridge-entry/${weighbridgeSlipNo}/photo-approval`, null, {
        params: {
          approved: false,
          user_id: user.id,
          rejection_reason: rejectionReason || 'No reason provided'
        }
      });
      
      // Close modals and return to queue
      setShowRejectionDialog(false);
      setShowPhotoModal(false);
      setSlipData(null);
      setWeighbridgeSlipNo('');
      setRejectionReason('');
      
      toast.error('Photos rejected. Slip returned to queue.');
      fetchQueue();
      
    } catch (error) {
      toast.error('Failed to reject photos');
    }
  };

  const autoFillFromSlip = async (data) => {
    setFarmerName(data.party_name || '');
    setMobile(data.party_mobile || '');
    setTokenNo(data.token_no || '');
    
    // Fetch village (stored as city) from parties collection with role=farmer
    if (data.party_mobile) {
      try {
        const response = await axios.get(`${API}/parties`);
        const farmer = response.data.find(p => 
          p.roles?.includes('farmer') && p.contact === data.party_mobile
        );
        if (farmer) {
          setVillage(farmer.city || '');  // Village is stored in city field
        }
      } catch (error) {
        console.log('Could not fetch farmer village:', error);
        setVillage('');
      }
    } else {
      setVillage('');
    }
    
    // Auto-fill first line item
    const newLines = [...lines];
    newLines[0] = {
      ...newLines[0],
      itemId: data.item_id || '',
      itemName: data.item_name || '',
      packKg: 100,
      bags: data.bags || 0,
      remKg: data.rem_kg || 0,
      actKg: data.net_weight || 0,
      actQtl: data.act_qtl || 0,
      ratePerQtl: data.rate_per_qtl || 0,
      originalRate: data.rate_per_qtl || 0,  // Store original rate
      vehicleType: data.vehicle_type || 'Truck'
    };
    
    // Calculate H+T and totals
    calculateLineTotal(0, newLines);
    setLines(newLines);
  };

  const calculateLineTotal = (index, currentLines, skipField = null) => {
    const line = currentLines[index];
    
    // Calculate Act.Qtl if not manual override
    if (skipField !== 'actQtl') {
      const actKg = (line.bags * line.packKg) + line.remKg;
      const actQtl = actKg / 100;
      currentLines[index].actKg = actKg;
      currentLines[index].actQtl = parseFloat(actQtl.toFixed(2));
    }
    
    // Calculate Item Amount if not manual override
    if (skipField !== 'itemAmount') {
      const itemAmount = line.ratePerQtl * currentLines[index].actQtl;
      currentLines[index].itemAmount = Math.round(itemAmount);
    }
    
    // Calculate H+T if not manual override
    if (skipField !== 'hPlusT') {
      let hPlusTRate = 0;
      if (line.vehicleType === 'Truck') hPlusTRate = 4.75;
      else if (line.vehicleType === 'Hammali') hPlusTRate = 5.75;
      
      const hPlusT = hPlusTRate * currentLines[index].actQtl;
      currentLines[index].hPlusT = Math.round(hPlusT);
    }
    
    // Calculate Line Total if not manual override
    if (skipField !== 'lineTotal') {
      const lineTotal = currentLines[index].itemAmount - currentLines[index].hPlusT;
      currentLines[index].lineTotal = Math.round(lineTotal);
    }
  };

  const handleLineChange = (index, field, value, isManualOverride = false) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    
    // If manual override, skip recalculating that field
    if (isManualOverride) {
      calculateLineTotal(index, newLines, field);
    } else {
      calculateLineTotal(index, newLines);
    }
    
    setLines(newLines);
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
        weighbridge_slip_no: weighbridgeSlipNo,
        farmer_name: farmerName,
        mobile,
        village,  // Changed from city to village
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
    setWeighbridgeSlipNo('');
    setTulaiNo('');
    setAgrNo('');
    setFarmerName('');
    setMobile('');
    setVillage('');
    setTokenNo('');
    setCashBankAcId('');
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
                  <Label>Slip ID / Weighbridge Slip No</Label>
                  <Input
                    value={weighbridgeSlipNo}
                    onChange={(e) => setWeighbridgeSlipNo(e.target.value)}
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
                      if (weighbridgeSlipNo) {
                        handleProcessPayment(weighbridgeSlipNo);
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

          {/* Photo Approval Modal */}
          <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl" style={{color: '#3E2723'}}>
                  📸 Weighbridge Photos - Approval Required
                </DialogTitle>
                {slipData && (
                  <p className="text-sm" style={{color: '#6B5846'}}>
                    Slip ID: <strong>{slipData.slip_id}</strong> | Farmer: <strong>{slipData.party_name}</strong>
                  </p>
                )}
              </DialogHeader>

              {slipData && (
                <div className="space-y-6">
                  {/* Photo Upload Status Warning */}
                  {slipData.photo_upload_status !== 'success' && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Photo upload status: {slipData.photo_upload_status}. You can still approve.
                      </p>
                    </div>
                  )}

                  {/* Side-by-Side Photos */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Gross Weight Photo */}
                    <div className="space-y-2">
                      <div 
                        className="relative border-2 rounded-lg overflow-hidden cursor-pointer hover:border-green-500 transition-all"
                        onClick={() => setZoomedPhoto(slipData.photo_gross_url)}
                        style={{height: '400px'}}
                      >
                        <img 
                          src={slipData.photo_gross_url} 
                          alt="Gross Weight"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                          🔼 Gross Weight
                        </div>
                        <div className="absolute bottom-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs">
                          Click to enlarge
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-lg">{slipData.gross_weight} kg</p>
                        <p className="text-xs text-gray-600">{formatDateTime(slipData.photo_gross_timestamp)}</p>
                      </div>
                    </div>

                    {/* Tare Weight Photo */}
                    <div className="space-y-2">
                      <div 
                        className="relative border-2 rounded-lg overflow-hidden cursor-pointer hover:border-green-500 transition-all"
                        onClick={() => setZoomedPhoto(slipData.photo_tare_url)}
                        style={{height: '400px'}}
                      >
                        <img 
                          src={slipData.photo_tare_url} 
                          alt="Tare Weight"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                          🔽 Tare Weight
                        </div>
                        <div className="absolute bottom-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs">
                          Click to enlarge
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-lg">{slipData.tare_weight} kg</p>
                        <p className="text-xs text-gray-600">{formatDateTime(slipData.photo_tare_timestamp)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <Card className="p-4" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Vehicle</p>
                        <p className="font-bold">{slipData.vehicle_number} ({slipData.vehicle_type})</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Item & Quantity</p>
                        <p className="font-bold">{slipData.item_name} | {slipData.net_weight} kg = {slipData.act_qtl} qtl</p>
                      </div>
                      <div>
                        <p className="text-sm" style={{color: '#6B5846'}}>Farmer</p>
                        <p className="font-bold">{slipData.party_name} | {slipData.party_mobile}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={handleRejectPhotos}
                      className="btn-secondary py-4 text-lg"
                    >
                      ❌ Reject Photos
                    </Button>
                    <Button 
                      onClick={handleApprovePhotos}
                      className="btn-primary py-4 text-lg"
                    >
                      ✅ Approve & Continue
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Photo Zoom Modal */}
          <Dialog open={!!zoomedPhoto} onOpenChange={() => setZoomedPhoto(null)}>
            <DialogContent className="max-w-6xl max-h-[95vh]">
              <DialogHeader>
                <DialogTitle>Weighbridge Photo (Full View)</DialogTitle>
              </DialogHeader>
              {zoomedPhoto && (
                <div className="flex items-center justify-center">
                  <img 
                    src={zoomedPhoto} 
                    alt="Zoomed"
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Rejection Reason Dialog */}
          <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rejection Reason (Optional)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Why are you rejecting these photos?</Label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., Poor quality, Wrong vehicle, etc. (optional)"
                    className="w-full mt-2 p-2 border rounded"
                    rows={3}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => setShowRejectionDialog(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmRejection}
                    className="bg-red-600 hover:bg-red-700 text-white flex-1"
                  >
                    Confirm Rejection
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
          {/* Header Section */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Document Details</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Weighbridge Slip No</Label>
                <Input 
                  value={weighbridgeSlipNo} 
                  onChange={(e) => setWeighbridgeSlipNo(e.target.value)} 
                  placeholder="WB-25-000001"
                  readOnly
                />
              </div>
              <div>
                <Label>Tulai No</Label>
                <Input 
                  value={tulaiNo} 
                  onChange={(e) => setTulaiNo(e.target.value)} 
                  placeholder="Tulai number"
                />
              </div>
              <div>
                <Label>Agreement No</Label>
                <Input 
                  value={agrNo} 
                  onChange={(e) => setAgrNo(e.target.value)} 
                  placeholder="Agreement number"
                />
              </div>
            </div>
          </Card>

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
                <Label>Village</Label>
                <Input value={village} onChange={(e) => setVillage(e.target.value)} />
              </div>
              <div>
                <Label>Token No</Label>
                <Input value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} />
              </div>
            </div>
          </Card>

          {/* Line Items - Editable Grid */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Item Details</h2>
            {lines.map((line, idx) => (
              <div key={idx} className="space-y-4">
                {/* Row 1: Item & Quantity Details */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Item & Quantity</Label>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <Label className="text-xs">Item *</Label>
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const selectedItem = items.find(i => i.id === e.target.value);
                          handleLineChange(idx, 'itemId', e.target.value);
                          handleLineChange(idx, 'itemName', selectedItem?.name || '');
                        }}
                        className="erp-select mt-1"
                        required
                      >
                        <option value="">Select Item</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Pack (kg)</Label>
                      <Input
                        type="number"
                        value={line.packKg}
                        onChange={(e) => handleLineChange(idx, 'packKg', parseFloat(e.target.value) || 100)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bags</Label>
                      <Input
                        type="number"
                        value={line.bags}
                        readOnly
                        className="mt-1 bg-gray-100"
                        title="From weighbridge (read-only)"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Rem Kg</Label>
                      <Input
                        type="number"
                        value={line.remKg}
                        readOnly
                        className="mt-1 bg-gray-100"
                        title="From weighbridge (read-only)"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Act.Qtl</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.actQtl}
                        onChange={(e) => handleLineChange(idx, 'actQtl', parseFloat(e.target.value) || 0, true)}
                        className="mt-1 font-bold"
                        style={{color: '#6B8E23'}}
                        title="Editable - Manual override possible"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Pricing & Calculations */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Pricing & Calculations</Label>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <Label className="text-xs">Rate (₹/qtl) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.ratePerQtl}
                        onChange={(e) => handleLineChange(idx, 'ratePerQtl', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        required
                        title="Editable rate"
                      />
                      {line.originalRate && line.originalRate !== line.ratePerQtl && (
                        <p className="text-xs text-gray-500 mt-1">Original: ₹{line.originalRate}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Item Amount</Label>
                      <Input
                        type="number"
                        value={line.itemAmount}
                        onChange={(e) => handleLineChange(idx, 'itemAmount', parseFloat(e.target.value) || 0, true)}
                        className="mt-1 font-bold"
                        title="Editable - Manual override possible"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Vehicle Type *</Label>
                      <select
                        value={line.vehicleType}
                        onChange={(e) => handleLineChange(idx, 'vehicleType', e.target.value)}
                        className="erp-select mt-1"
                        required
                      >
                        <option value="Truck">Truck</option>
                        <option value="Tractor">Tractor</option>
                        <option value="Hammali">Hammali</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">H+T</Label>
                      <Input
                        type="number"
                        value={line.hPlusT}
                        onChange={(e) => handleLineChange(idx, 'hPlusT', parseFloat(e.target.value) || 0, true)}
                        className="mt-1"
                        title="Editable - Manual override possible"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Line Total</Label>
                      <Input
                        type="number"
                        value={line.lineTotal}
                        onChange={(e) => handleLineChange(idx, 'lineTotal', parseFloat(e.target.value) || 0, true)}
                        className="mt-1 font-bold"
                        style={{color: '#6B8E23'}}
                        title="Editable - Manual override possible"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Payment Details */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Payment Details</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <Label>Pay Type</Label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)} className="erp-select">
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Both">Both</option>
                </select>
              </div>
              <div>
                <Label>Cash/Bank A/c ID</Label>
                <Input 
                  value={cashBankAcId} 
                  onChange={(e) => setCashBankAcId(e.target.value)} 
                  placeholder="Account identifier"
                />
              </div>
              <div>
                <Label>Additional Hamli</Label>
                <Input 
                  type="number" 
                  value={additionalHamli} 
                  onChange={(e) => setAdditionalHamli(parseFloat(e.target.value) || 0)} 
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Bank Charges</Label>
                <Input 
                  type="number" 
                  value={bankCharges} 
                  onChange={(e) => setBankCharges(parseFloat(e.target.value) || 0)} 
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(payType === 'Cash' || payType === 'Both') && (
                <div>
                  <Label>Cash Amount</Label>
                  <Input 
                    type="number" 
                    value={cashAmt} 
                    onChange={(e) => setCashAmt(parseFloat(e.target.value) || 0)} 
                    placeholder="0"
                  />
                </div>
              )}
              {(payType === 'Bank' || payType === 'Both') && (
                <div>
                  <Label>Bank Amount</Label>
                  <Input 
                    type="number" 
                    value={bankAmt} 
                    onChange={(e) => setBankAmt(parseFloat(e.target.value) || 0)} 
                    placeholder="0"
                  />
                </div>
              )}
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

        {/* Success Modal with Print Option */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center" style={{color: '#3E2723'}}>
                ✅ Payment Saved Successfully!
              </DialogTitle>
            </DialogHeader>
            
            {savedPayment && (
              <div className="space-y-6">
                {/* Voucher Details */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <p className="text-sm mb-2" style={{color: '#6B5846'}}>Purchase Voucher</p>
                    <p className="font-bold text-lg">{savedPayment.purchase_voucher_id?.substring(0, 8)}...</p>
                  </Card>
                  <Card className="p-4" style={{background: 'rgba(212, 175, 55, 0.1)'}}>
                    <p className="text-sm mb-2" style={{color: '#6B5846'}}>Payment Voucher</p>
                    <p className="font-bold text-lg">{savedPayment.payment_voucher_id?.substring(0, 8)}...</p>
                  </Card>
                </div>

                {/* Payment Summary */}
                <Card className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm" style={{color: '#6B5846'}}>Book No</p>
                      <p className="font-bold text-xl">{savedPayment.book_no}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{color: '#6B5846'}}>Total Amount</p>
                      <p className="font-bold text-xl" style={{color: '#6B8E23'}}>
                        {formatCurrency(savedPayment.total_amount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm" style={{color: '#6B5846'}}>Farmer</p>
                    <p className="font-bold">{savedPayment.farmer_name} | {savedPayment.mobile}</p>
                  </div>
                </Card>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    onClick={() => window.print()}
                    className="btn-secondary"
                  >
                    🖨️ Print
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowSuccessModal(false);
                      setSavedPayment(null);
                      // Stay in form to process another
                    }}
                    className="btn-secondary"
                  >
                    📝 Process Another
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowSuccessModal(false);
                      setSavedPayment(null);
                      resetForm();
                      setView('queue');
                      fetchQueue();
                    }}
                    className="btn-primary"
                  >
                    ✅ Back to Queue
                  </Button>
                </div>

                {/* Print View (Hidden on Screen) - Profarma-4 Payment Voucher */}
                <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white">
                  <style>{`
                    @media print {
                      @page { size: A4; margin: 8mm; }
                      body { margin: 0; }
                      .no-break { page-break-inside: avoid; }
                      /* Hide Emergent watermark and other UI elements when printing */
                      header, nav, .sidebar, [class*="emergent"], [class*="watermark"] { display: none !important; }
                    }
                  `}</style>

                  {/* HINDI COPY - Profarma-4 Payment Voucher */}
                  <div className="p-2 no-break" style={{fontFamily: 'Arial, sans-serif'}}>
                    {/* Header */}
                    <div className="text-center mb-1 pb-1 border-b border-black">
                      <h2 className="text-sm font-bold">Profarma - 4 Payment Voucher</h2>
                      <p className="text-[8px]">(Under Bye Law - 17(4))</p>
                    </div>

                    {/* Document Details */}
                    <div className="grid grid-cols-3 gap-1 mb-1 text-[10px]">
                      <div>
                        <span className="font-semibold">Date :</span> {new Date(savedPayment.date).toLocaleDateString('en-IN')}
                      </div>
                      <div>
                        <span className="font-semibold">Book No.</span> {savedPayment.book_no}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{savedPayment.location}</span>
                      </div>
                    </div>

                    {/* Purchaser & Seller Details */}
                    <div className="mb-1 p-1 border border-gray-400">
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div>
                          <p className="font-semibold text-[9px]">Name and License No. of Purchaser</p>
                          <p className="font-bold text-[10px]">M/S Sudarshan Trading Company</p>
                        </div>
                        <div>
                          {savedPayment.weighbridge_slip_no && (
                            <div className="text-right">
                              <p className="font-semibold text-[9px]">Weight Slip</p>
                              <p className="font-bold text-[10px]">{savedPayment.weighbridge_slip_no}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                        <div>
                          <span className="font-semibold text-[9px]">Name of Seller</span>
                          <p className="font-bold text-[10px]">{savedPayment.farmer_name}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-[9px]">Mob. No. :</span> {savedPayment.mobile}
                        </div>
                      </div>
                    </div>

                    {/* Items Table - Hindi Labels */}
                    <div className="mb-1">
                      <table className="w-full text-[10px] border-collapse border border-black">
                        <thead>
                          <tr className="bg-gray-200">
                            <th className="border border-black p-0.5" style={{width: '12%'}}>कृषि उपज का नाम<br/><span className="text-[8px]">Item Name</span></th>
                            <th className="border border-black p-0.5" style={{width: '10%'}}>अनुबंध/सौदा पत्रक के आधार पर वजन<br/><span className="text-[8px]">Expected Wt</span></th>
                            <th className="border border-black p-0.5" style={{width: '10%'}}>तोल परची के आधार पर वास्तविक वजन<br/><span className="text-[8px]">Actual Wt (qtl)</span></th>
                            <th className="border border-black p-0.5" style={{width: '8%'}}>दर<br/><span className="text-[8px]">Rate</span></th>
                            <th className="border border-black p-0.5" style={{width: '12%'}}>कृषि उपज का मूल्य<br/><span className="text-[8px]">Value</span></th>
                            <th className="border border-black p-0.5" style={{width: '12%'}}>कुल मूल्य<br/><span className="text-[8px]">Total Value</span></th>
                            <th className="border border-black p-0.5" style={{width: '10%'}}>कुल हम्माली और तुलाई<br/><span className="text-[8px]">Total H+T</span></th>
                            <th className="border border-black p-0.5" style={{width: '8%'}}>उपविधि के अनुसार हम्माली दर<br/><span className="text-[8px]">H+T Rate</span></th>
                            <th className="border border-black p-0.5" style={{width: '14%'}}>विक्रेता को भुगतान की गई राशि<br/><span className="text-[8px]">Amount Paid</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {savedPayment.lines?.map((line, idx) => {
                            // Calculate H+T rate based on vehicle type
                            const htRate = line.vehicle_type === 'Truck' ? 4.75 : line.vehicle_type === 'Hammali' ? 5.75 : 0;
                            return (
                              <tr key={idx}>
                                <td className="border border-black p-0.5">{line.item_name}</td>
                                <td className="border border-black p-0.5 text-right">{line.bags || 'N/A'}</td>
                                <td className="border border-black p-0.5 text-right">{line.act_qtl}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.rate_per_qtl}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.item_amount.toFixed(2)}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.item_amount.toFixed(2)}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.h_plus_t.toFixed(2)}</td>
                                <td className="border border-black p-0.5 text-right">{htRate}</td>
                                <td className="border border-black p-0.5 text-right font-bold">₹{line.line_total.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Payment Details & Totals - Single Line */}
                    <div className="mb-1">
                      <div className="flex justify-between items-center text-[10px] border-t border-black pt-1">
                        <div>
                          {savedPayment.pay_type === 'Cash' && (
                            <span className="font-semibold">Cash Amount: ₹{savedPayment.cash_amt.toFixed(2)}</span>
                          )}
                          {(savedPayment.pay_type === 'Bank' || savedPayment.pay_type === 'RTGS' || savedPayment.pay_type === 'NEFT') && savedPayment.account_no && (
                            <span className="font-semibold">Bank: {savedPayment.account_no} | ₹{savedPayment.bank_amt.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="font-bold">
                          <span>Net Amount: ₹{savedPayment.total_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Signatures - 2 Only */}
                    <div className="mt-2 pt-2">
                      <div className="grid grid-cols-2 gap-4 text-center text-[10px]">
                        <div>
                          <div className="h-6"></div>
                          <div className="border-t border-black pt-0.5">
                            <p className="font-semibold">क्रेता के हस्ताक्षर</p>
                            <p className="text-[8px]">Kretaa ke Hastakshar</p>
                          </div>
                        </div>
                        <div>
                          <div className="h-6"></div>
                          <div className="border-t border-black pt-0.5">
                            <p className="font-semibold">विक्रेता के भुगतान प्राप्ति के हस्ताक्षर</p>
                            <p className="text-[8px]">Vikretaa ke Bhugtaan prapti ke Hastakshar</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[8px] text-gray-600 mt-1 text-center border-t pt-0.5">
                      Purchase: {savedPayment.purchase_voucher_id} | Payment: {savedPayment.payment_voucher_id}
                    </div>
                  </div>

                  {/* PERFORATION LINE - Dashed Border */}
                  <div className="border-t-2 border-dashed border-gray-400 my-2"></div>

                  {/* ENGLISH COPY - Office Record */}
                  <div className="p-2 no-break" style={{fontFamily: 'Arial, sans-serif'}}>
                    {/* Header */}
                    <div className="text-center mb-1 pb-1 border-b border-black">
                      <h2 className="text-sm font-bold">Payment Voucher (Office Record)</h2>
                      <p className="text-[8px]">Profarma - 4 (Under Bye Law - 17(4))</p>
                    </div>

                    {/* Document Details */}
                    <div className="grid grid-cols-3 gap-1 mb-1 text-[10px]">
                      <div><span className="font-semibold">Date:</span> {new Date(savedPayment.date).toLocaleDateString('en-IN')}</div>
                      <div><span className="font-semibold">Book No:</span> {savedPayment.book_no}</div>
                      <div className="text-right"><span className="font-semibold">Location:</span> {savedPayment.location}</div>
                    </div>

                    {/* Purchaser & Seller Details */}
                    <div className="mb-1 p-1 border border-gray-400">
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div>
                          <p className="font-semibold text-[9px]">Purchaser</p>
                          <p className="font-bold text-[10px]">M/S Sudarshan Trading Company</p>
                        </div>
                        <div>
                          {savedPayment.weighbridge_slip_no && (
                            <div className="text-right">
                              <p className="font-semibold text-[9px]">Weight Slip</p>
                              <p className="font-bold text-[10px]">{savedPayment.weighbridge_slip_no}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
                        <div>
                          <span className="font-semibold text-[9px]">Seller:</span>
                          <p className="font-bold text-[10px]">{savedPayment.farmer_name}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-[9px]">Mobile:</span> {savedPayment.mobile}
                        </div>
                        <div>
                          {savedPayment.village && (
                            <div><span className="font-semibold text-[9px]">Village:</span> {savedPayment.village}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items Table - English */}
                    <div className="mb-1">
                      <table className="w-full text-[10px] border-collapse border border-black">
                        <thead>
                          <tr className="bg-gray-200">
                            <th className="border border-black p-0.5" style={{width: '12%'}}>Item Name</th>
                            <th className="border border-black p-0.5" style={{width: '10%'}}>Expected Weight</th>
                            <th className="border border-black p-0.5" style={{width: '10%'}}>Actual Weight (qtl)</th>
                            <th className="border border-black p-0.5" style={{width: '8%'}}>Rate</th>
                            <th className="border border-black p-0.5" style={{width: '12%'}}>Value</th>
                            <th className="border border-black p-0.5" style={{width: '12%'}}>Total Value</th>
                            <th className="border border-black p-0.5" style={{width: '10%'}}>Total H+T</th>
                            <th className="border border-black p-0.5" style={{width: '8%'}}>H+T Rate</th>
                            <th className="border border-black p-0.5" style={{width: '14%'}}>Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {savedPayment.lines?.map((line, idx) => {
                            const htRate = line.vehicle_type === 'Truck' ? 4.75 : line.vehicle_type === 'Hammali' ? 5.75 : 0;
                            return (
                              <tr key={idx}>
                                <td className="border border-black p-0.5">{line.item_name}</td>
                                <td className="border border-black p-0.5 text-right">{line.bags || 'N/A'}</td>
                                <td className="border border-black p-0.5 text-right">{line.act_qtl}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.rate_per_qtl}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.item_amount.toFixed(2)}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.item_amount.toFixed(2)}</td>
                                <td className="border border-black p-0.5 text-right">₹{line.h_plus_t.toFixed(2)}</td>
                                <td className="border border-black p-0.5 text-right">{htRate}</td>
                                <td className="border border-black p-0.5 text-right font-bold">₹{line.line_total.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Payment Details - Single Line */}
                    <div className="mb-1">
                      <div className="flex justify-between items-center text-[10px] border-t border-black pt-1">
                        <div>
                          <span className="font-semibold">Mode: {savedPayment.pay_type} | Type: {savedPayment.mandi_godown}</span>
                          {(savedPayment.pay_type === 'Bank' || savedPayment.pay_type === 'RTGS' || savedPayment.pay_type === 'NEFT') && savedPayment.account_no && (
                            <span> | Acc: {savedPayment.account_no}</span>
                          )}
                        </div>
                        <div className="font-bold">
                          <span>Net Amount: ₹{savedPayment.total_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Voucher IDs */}
                    <div className="mb-1 p-1 bg-gray-100 text-[8px]">
                      <div><span className="font-semibold">Purchase:</span> {savedPayment.purchase_voucher_id}</div>
                      <div><span className="font-semibold">Payment:</span> {savedPayment.payment_voucher_id}</div>
                    </div>

                    {/* Signatures */}
                    <div className="mt-2 pt-2">
                      <div className="grid grid-cols-2 gap-4 text-center text-[10px]">
                        <div>
                          <div className="h-6"></div>
                          <div className="border-t border-black pt-0.5">Buyer's Signature</div>
                        </div>
                        <div>
                          <div className="h-6"></div>
                          <div className="border-t border-black pt-0.5">Seller's Payment Receipt Signature</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[8px] text-gray-600 mt-1 text-center border-t pt-0.5">
                      Generated: {new Date().toLocaleString('en-IN')} | GrainTrade ERP
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default FarmerPaymentPage;
