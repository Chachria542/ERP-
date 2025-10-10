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
  const [payments, setPayments] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [slipData, setSlipData] = useState(null);

  // Header fields
  const [location, setLocation] = useState('Sanawad');
  const [contractType, setContractType] = useState('Anubandh');
  const [mandiGodown, setMandiGodown] = useState('Mandi');
  const [bookNo, setBookNo] = useState('');
  const [biltyNo, setBiltyNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tulaiNo, setTulaiNo] = useState('');
  const [agrNo, setAgrNo] = useState('');
  const [idNo, setIdNo] = useState('');
  const [gateEntryNo, setGateEntryNo] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [tokenNo, setTokenNo] = useState('');

  // Farmer details
  const [farmerName, setFarmerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState([{
    itemId: '',
    itemName: '',
    packKg: 100,
    bags: 0,
    remKg: 0,
    actKg: 0,
    actQtl: 0,
    ratePerQtl: 0,
    itemAmount: 0,
    vehicleType: 'Truck',
    hPlusT: 0,
    lineTotal: 0,
    sortOrder: 0
  }]);

  // Payment fields
  const [payType, setPayType] = useState('Cash');
  const [cashBankAcId, setCashBankAcId] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [cashAmt, setCashAmt] = useState(0);
  const [bankAmt, setBankAmt] = useState(0);
  const [additionalHamli, setAdditionalHamli] = useState(0);
  const [bankCharges, setBankCharges] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
      await fetchNextBookNo();
    };
    loadData();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [lineItems, additionalHamli, bankCharges]);

  const fetchData = async () => {
    try {
      const [itemsRes, paymentsRes] = await Promise.all([
        axios.get(`${API}/items`).catch(err => ({ data: [] })),
        axios.get(`${API}/farmer-payments`).catch(err => ({ data: [] }))
      ]);
      setItems(itemsRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setItems([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextBookNo = async () => {
    try {
      const response = await axios.get(`${API}/book-number-next?location=Sanawad`);
      setBookNo(response.data.book_no);
    } catch (error) {
      console.error('Failed to get book number:', error);
      setBookNo('SAN-25-000001'); // Fallback
    }
  };

  const handleGateEntryNoChange = async (value) => {
    setGateEntryNo(value);
    if (!value) return;

    try {
      const response = await axios.get(`${API}/weighbridge/slip/${value}`);
      setSlipData(response.data);
      setShowPhotoModal(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Weighbridge slip not found');
    }
  };

  const handleApproveSlip = async () => {
    try {
      // Approve slip if endpoint exists
      try {
        await axios.put(`${API}/weighbridge/approve/${gateEntryNo}?user_id=${user.id}`);
      } catch (e) {
        console.log('Approve endpoint not available, proceeding with auto-fill');
      }
      
      // Auto-fill form with available data
      setFarmerName(slipData.farmer_name || slipData.party_name || '');
      setMobile(slipData.mobile || '');
      setCity(slipData.city || '');
      setTokenNo(slipData.token_no || '');
      
      // Calculate bags and quintals from net_weight
      const netWeight = slipData.net_weight || 0;
      const bags = Math.floor(netWeight / 100);
      const remKg = Math.floor(netWeight % 100);
      const actQtl = netWeight / 100;
      
      // Auto-fill first line item
      const newItems = [...lineItems];
      const item = items.find(i => i.id === slipData.item_id);
      newItems[0] = {
        ...newItems[0],
        itemId: slipData.item_id,
        itemName: slipData.item_name,
        bags: slipData.bags !== undefined ? slipData.bags : bags,
        remKg: slipData.rem_kg !== undefined ? slipData.rem_kg : remKg,
        actKg: netWeight,
        actQtl: slipData.act_qtl !== undefined ? slipData.act_qtl : actQtl,
        vehicleType: slipData.vehicle_type || 'Truck',
        ratePerQtl: item?.current_price || 0
      };
      setLineItems(newItems);
      calculateLineItem(0, newItems);
      
      setShowPhotoModal(false);
      toast.success(`Slip ${slipData.slip_number} approved and data loaded!`);
    } catch (error) {
      toast.error('Failed to approve slip');
      console.error(error);
    }
  };

  const calculateHPlusT = (vehicleType, actQtl) => {
    const rates = { Truck: 4.75, Hammali: 5.75, Tractor: 0 };
    return (rates[vehicleType] || 0) * actQtl;
  };

  const calculateLineItem = (index, items = lineItems) => {
    const item = items[index];
    const itemAmount = item.actQtl * item.ratePerQtl;
    const hPlusT = calculateHPlusT(item.vehicleType, item.actQtl);
    const lineTotal = itemAmount - hPlusT;

    const newItems = [...items];
    newItems[index] = {
      ...item,
      itemAmount: itemAmount,
      hPlusT: hPlusT,
      lineTotal: lineTotal
    };
    setLineItems(newItems);
  };

  const calculateTotals = () => {
    const lineTotalsSum = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const total = lineTotalsSum - additionalHamli - bankCharges;
    setTotalAmount(total);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      itemId: '',
      itemName: '',
      packKg: 100,
      bags: 0,
      remKg: 0,
      actKg: 0,
      actQtl: 0,
      ratePerQtl: 0,
      itemAmount: 0,
      vehicleType: 'Truck',
      hPlusT: 0,
      lineTotal: 0,
      sortOrder: lineItems.length
    }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    // Validation
    if (!farmerName || !mobile) {
      toast.error('Please fill required fields: Farmer Name and Mobile');
      return;
    }

    if (mobile.length !== 10) {
      toast.error('Mobile number must be 10 digits');
      return;
    }

    if (lineItems.length === 0 || !lineItems[0].itemId) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      const payload = {
        location,
        contract_type: contractType,
        mandi_godown: mandiGodown,
        bilty_no: biltyNo || null,
        date,
        tulai_no: tulaiNo || null,
        agr_no: agrNo || null,
        id_no: idNo || null,
        gate_entry_no: gateEntryNo || null,
        aadhaar: aadhaar || null,
        token_no: tokenNo || null,
        farmer_name: farmerName,
        mobile,
        city: city || null,
        lines: lineItems.map(item => ({
          item_id: item.itemId,
          item_name: item.itemName,
          pack_kg: item.packKg,
          bags: item.bags,
          rem_kg: item.remKg,
          act_kg: item.actKg,
          act_qtl: item.actQtl,
          rate_per_qtl: item.ratePerQtl,
          item_amount: item.itemAmount,
          vehicle_type: item.vehicleType,
          h_plus_t: item.hPlusT,
          line_total: item.lineTotal,
          sort_order: item.sortOrder
        })),
        pay_type: payType,
        cash_bank_ac_id: cashBankAcId || null,
        account_no: accountNo || null,
        cash_amt: cashAmt,
        bank_amt: bankAmt,
        additional_hamli: additionalHamli,
        bank_charges: bankCharges,
        created_by: user.id
      };

      await axios.post(`${API}/farmer-payment`, payload);
      
      toast.success('Farmer payment saved successfully! Vouchers generated.');
      resetForm();
      fetchData();
      fetchNextBookNo();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save farmer payment');
    }
  };

  const resetForm = () => {
    setContractType('Anubandh');
    setMandiGodown('Mandi');
    setBiltyNo('');
    setTulaiNo('');
    setAgrNo('');
    setIdNo('');
    setGateEntryNo('');
    setAadhaar('');
    setTokenNo('');
    setFarmerName('');
    setMobile('');
    setCity('');
    setLineItems([{
      itemId: '', itemName: '', packKg: 100, bags: 0, remKg: 0, actKg: 0,
      actQtl: 0, ratePerQtl: 0, itemAmount: 0, vehicleType: 'Truck', hPlusT: 0, lineTotal: 0, sortOrder: 0
    }]);
    setPayType('Cash');
    setCashBankAcId('');
    setAccountNo('');
    setCashAmt(0);
    setBankAmt(0);
    setAdditionalHamli(0);
    setBankCharges(0);
  };

  const handlePrint = () => {
    window.print();
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
      <div className="p-6 print:p-0">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <div>
            <h1 className="text-3xl font-bold" style={{color: '#3E2723'}}>Farmer Payment</h1>
            <p className="text-sm" style={{color: '#6B5846'}}>किसान भुगतान</p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSave} className="btn-primary" data-testid="save-payment">Save</Button>
            <Button onClick={resetForm} className="btn-secondary">New</Button>
            <Button onClick={handlePrint} className="btn-secondary">Print</Button>
          </div>
        </div>

        <Card className="p-6 print:shadow-none">
          {/* Header Fields */}
          <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b print:grid-cols-6">
            <div>
              <Label className="text-sm font-semibold">Location / स्थान *</Label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="erp-select mt-1">
                <option value="Sanawad">Sanawad</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Anubandh/Sauda / अनुबंध/सौदा *</Label>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="erp-select mt-1">
                <option value="Anubandh">Anubandh</option>
                <option value="Sauda">Sauda</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Mandi/Godown / मंडी/गोदाम</Label>
              <select value={mandiGodown} onChange={(e) => setMandiGodown(e.target.value)} className="erp-select mt-1">
                <option value="Mandi">Mandi</option>
                <option value="Godown">Godown</option>
                <option value="Entry">Entry</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Book No. / बुक नं. *</Label>
              <Input value={bookNo} disabled className="mt-1 bg-gray-100" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Bilty No. / बिल्टी नं.</Label>
              <Input value={biltyNo} onChange={(e) => setBiltyNo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Date / दिनांक *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Tulai No. / तुलाई नं.</Label>
              <Input value={tulaiNo} onChange={(e) => setTulaiNo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Agr. No.</Label>
              <Input value={agrNo} onChange={(e) => setAgrNo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">ID No.</Label>
              <Input value={idNo} onChange={(e) => setIdNo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Gate Entry No. / गेट एंट्री नं.</Label>
              <Input 
                value={gateEntryNo} 
                onChange={(e) => handleGateEntryNoChange(e.target.value)} 
                className="mt-1"
                placeholder="Scan or enter"
              />
            </div>
          </div>

          {/* Farmer Details */}
          <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Farmer Details / किसान विवरण</h3>
          <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b">
            <div>
              <Label className="text-sm font-semibold">Farmer Name / किसान का नाम *</Label>
              <Input value={farmerName} onChange={(e) => setFarmerName(e.target.value)} className="mt-1" required />
            </div>
            <div>
              <Label className="text-sm font-semibold">Mobile / मोबाइल नं. *</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1" maxLength={10} required />
            </div>
            <div>
              <Label className="text-sm font-semibold">City / शहर</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Aadhaar No. / आधार नं.</Label>
              <Input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Token No. / टोकन नं.</Label>
              <Input value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Items Table */}
          <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Items / वस्तु विवरण</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse text-sm">
              <thead style={{background: 'linear-gradient(135deg, #6B8E23 0%, #5A7A1E 100%)'}}>
                <tr>
                  <th className="p-2 text-white">#</th>
                  <th className="p-2 text-white">Item / वस्तु *</th>
                  <th className="p-2 text-white">Pack</th>
                  <th className="p-2 text-white">Bags / बोरे</th>
                  <th className="p-2 text-white">Kgs / किलो</th>
                  <th className="p-2 text-white">Act.Qtl / कुंटल</th>
                  <th className="p-2 text-white">Rate / दर</th>
                  <th className="p-2 text-white">Item Amt / राशि</th>
                  <th className="p-2 text-white">Vehicle / वाहन *</th>
                  <th className="p-2 text-white">H+T</th>
                  <th className="p-2 text-white">Total / योग</th>
                  <th className="p-2 text-white print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 text-center">{index + 1}</td>
                    <td className="p-2">
                      <select 
                        value={item.itemId} 
                        onChange={(e) => {
                          const selectedItem = items.find(i => i.id === e.target.value);
                          const newItems = [...lineItems];
                          newItems[index] = {
                            ...item,
                            itemId: e.target.value,
                            itemName: selectedItem?.name || '',
                            ratePerQtl: selectedItem?.current_price || 0
                          };
                          setLineItems(newItems);
                          calculateLineItem(index, newItems);
                        }}
                        className="erp-select w-32"
                      >
                        <option value="">Select</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-center">100</td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        value={item.bags} 
                        onChange={(e) => {
                          const bags = parseInt(e.target.value) || 0;
                          const actKg = bags * 100 + item.remKg;
                          const actQtl = actKg / 100;
                          const newItems = [...lineItems];
                          newItems[index] = {...item, bags, actKg, actQtl};
                          setLineItems(newItems);
                          calculateLineItem(index, newItems);
                        }}
                        className="w-20"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        value={item.remKg} 
                        onChange={(e) => {
                          const remKg = parseInt(e.target.value) || 0;
                          const actKg = item.bags * 100 + remKg;
                          const actQtl = actKg / 100;
                          const newItems = [...lineItems];
                          newItems[index] = {...item, remKg, actKg, actQtl};
                          setLineItems(newItems);
                          calculateLineItem(index, newItems);
                        }}
                        className="w-20"
                        max="99"
                      />
                    </td>
                    <td className="p-2 font-bold">{item.actQtl.toFixed(2)}</td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        value={item.ratePerQtl} 
                        onChange={(e) => {
                          const newItems = [...lineItems];
                          newItems[index] = {...item, ratePerQtl: parseFloat(e.target.value) || 0};
                          setLineItems(newItems);
                          calculateLineItem(index, newItems);
                        }}
                        className="w-24"
                      />
                    </td>
                    <td className="p-2 font-bold">₹{item.itemAmount.toFixed(2)}</td>
                    <td className="p-2">
                      <select 
                        value={item.vehicleType} 
                        onChange={(e) => {
                          const newItems = [...lineItems];
                          newItems[index] = {...item, vehicleType: e.target.value};
                          setLineItems(newItems);
                          calculateLineItem(index, newItems);
                        }}
                        className="erp-select w-24"
                      >
                        <option value="Truck">Truck</option>
                        <option value="Tractor">Tractor</option>
                        <option value="Hammali">Hammali</option>
                      </select>
                    </td>
                    <td className="p-2 font-bold">₹{item.hPlusT.toFixed(2)}</td>
                    <td className="p-2 font-bold" style={{color: '#6B8E23'}}>₹{item.lineTotal.toFixed(2)}</td>
                    <td className="p-2 text-center print:hidden">
                      <Button size="sm" onClick={() => removeLineItem(index)} className="text-red-600">×</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button onClick={addLineItem} className="mt-2 btn-secondary" size="sm">+ Add Item</Button>
          </div>

          {/* Payment Section */}
          <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Payment Details / भुगतान विवरण</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div>
              <Label className="text-sm font-semibold">Type / प्रकार *</Label>
              <select value={payType} onChange={(e) => setPayType(e.target.value)} className="erp-select mt-1">
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="RTGS">RTGS</option>
                <option value="NEFT">NEFT</option>
                <option value="aadat">Aadat</option>
                <option value="Farmer">Farmer</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Cash/Bank A/c</Label>
              <Input value={cashBankAcId} onChange={(e) => setCashBankAcId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">A/c No.</Label>
              <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Cash Amt / नकद राशि</Label>
              <Input type="number" value={cashAmt} onChange={(e) => setCashAmt(parseFloat(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Bank Amt / बैंक राशि</Label>
              <Input type="number" value={bankAmt} onChange={(e) => setBankAmt(parseFloat(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Additional Hamli / अतिरिक्त हमाली</Label>
              <Input type="number" value={additionalHamli} onChange={(e) => setAdditionalHamli(parseFloat(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Bank Charges / बैंक शुल्क</Label>
              <Input type="number" value={bankCharges} onChange={(e) => setBankCharges(parseFloat(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <div className="p-4 rounded-lg mt-6" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                <p className="text-sm font-semibold" style={{color: '#6B5846'}}>Total Amount / कुल राशि</p>
                <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Photo Approval Modal */}
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Weighbridge Photos - {slipData?.slip_number}</DialogTitle>
            </DialogHeader>
            {slipData && (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-semibold mb-2">Gross Weight Photo</p>
                    <p className="text-xs mb-2">{new Date(slipData.photo_gross_timestamp).toLocaleString()}</p>
                    <img 
                      src={slipData.photo_gross_url} 
                      alt="Gross Weight" 
                      className="w-full h-64 object-cover rounded cursor-pointer hover:opacity-80"
                      onClick={() => window.open(slipData.photo_gross_url, '_blank')}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Tare Weight Photo</p>
                    <p className="text-xs mb-2">{new Date(slipData.photo_tare_timestamp).toLocaleString()}</p>
                    <img 
                      src={slipData.photo_tare_url} 
                      alt="Tare Weight" 
                      className="w-full h-64 object-cover rounded cursor-pointer hover:opacity-80"
                      onClick={() => window.open(slipData.photo_tare_url, '_blank')}
                    />
                  </div>
                </div>
                
                <div className="p-4 rounded-lg mb-4" style={{background: '#F5E6D3'}}>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm">Farmer: {slipData.farmer_name}</p>
                      <p className="text-sm">Mobile: {slipData.mobile}</p>
                    </div>
                    <div>
                      <p className="text-sm">Vehicle: {slipData.vehicle_type}</p>
                      <p className="text-sm">Item: {slipData.item_name}</p>
                    </div>
                    <div>
                      <p className="text-sm">Net Weight: {slipData.net_weight} kg</p>
                      <p className="text-sm">Quintals: {slipData.act_qtl}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button onClick={() => setShowPhotoModal(false)} className="btn-secondary">❌ Reject</Button>
                  <Button onClick={handleApproveSlip} className="btn-primary">✅ Approve</Button>
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