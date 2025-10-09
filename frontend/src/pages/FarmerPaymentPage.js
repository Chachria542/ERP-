import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function FarmerPaymentPage({ user, onLogout }) {
  const [payments, setPayments] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [weighbridgeSlips, setWeighbridgeSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Header fields
  const [location, setLocation] = useState('');
  const [anubandh, setAnubandh] = useState('');
  const [mandiGodown, setMandiGodown] = useState('');
  const [bookNo, setBookNo] = useState('');
  const [biltyNo, setBiltyNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tulaiNo, setTulaiNo] = useState('');
  const [tokenNo, setTokenNo] = useState('');

  // Farmer fields
  const [farmerId, setFarmerId] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [farmerNameHi, setFarmerNameHi] = useState('');
  const [city, setCity] = useState('');
  const [cityHi, setCityHi] = useState('');
  const [agrNo, setAgrNo] = useState('');
  const [idNo, setIdNo] = useState('');
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');

  // Item rows
  const [itemRows, setItemRows] = useState([{
    itemId: '', itemName: '', pack: '', bag: 0, kgs: 0, actKgs: 0, 
    rate: 0, itemAmt: 0, vehicle: '', htCharges: 0, total: 0
  }]);

  // Payment fields
  const [paymentType, setPaymentType] = useState('cash');
  const [cashBankAccount, setCashBankAccount] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [bankAmount, setBankAmount] = useState(0);
  const [additionalHammali, setAdditionalHammali] = useState(0);
  const [bankCharges, setBankCharges] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [itemRows, additionalHammali, bankCharges]);

  const fetchData = async () => {
    try {
      const [paymentsRes, partiesRes, itemsRes, slipsRes] = await Promise.all([
        axios.get(`${API}/farmer-payments`),
        axios.get(`${API}/parties`),
        axios.get(`${API}/items`),
        axios.get(`${API}/weighbridge/slips`)
      ]);
      
      setPayments(paymentsRes.data || []);
      setParties(partiesRes.data.filter(p => p.type === 'farmer'));
      setItems(itemsRes.data);
      setWeighbridgeSlips(slipsRes.data.filter(s => s.status === 'weighed'));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTulaiNoChange = async (tulaiValue) => {
    setTulaiNo(tulaiValue);
    if (!tulaiValue) return;

    try {
      const response = await axios.get(`${API}/weighbridge/slip/${tulaiValue}`);
      const slip = response.data;
      
      // Auto-populate from weighbridge slip
      setFarmerId(slip.party_id);
      setFarmerName(slip.party_name);
      
      // Find and set item
      const item = items.find(i => i.id === slip.item_id);
      if (item && itemRows.length > 0) {
        const newRows = [...itemRows];
        newRows[0] = {
          ...newRows[0],
          itemId: slip.item_id,
          itemName: slip.item_name,
          kgs: slip.net_weight || 0,
          actKgs: slip.net_weight || 0,
          rate: item.current_price || 0
        };
        setItemRows(newRows);
        calculateItemRow(0, newRows);
      }
      
      toast.success('Weighbridge data loaded!');
    } catch (error) {
      toast.error('Weighbridge slip not found');
    }
  };

  const calculateItemRow = (index, rows = itemRows) => {
    const row = rows[index];
    const itemAmt = row.rate * (row.actKgs || row.kgs || 0);
    const total = itemAmt - row.htCharges;
    
    const newRows = [...rows];
    newRows[index] = {
      ...row,
      itemAmt: itemAmt,
      total: total
    };
    setItemRows(newRows);
  };

  const calculateTotals = () => {
    const itemsTotal = itemRows.reduce((sum, row) => sum + row.total, 0);
    const final = itemsTotal - additionalHammali + bankCharges;
    setTotalAmount(final);
  };

  const addItemRow = () => {
    setItemRows([...itemRows, {
      itemId: '', itemName: '', pack: '', bag: 0, kgs: 0, actKgs: 0,
      rate: 0, itemAmt: 0, vehicle: '', htCharges: 0, total: 0
    }]);
  };

  const removeItemRow = (index) => {
    if (itemRows.length > 1) {
      const newRows = itemRows.filter((_, i) => i !== index);
      setItemRows(newRows);
    }
  };

  const handleSave = async () => {
    if (!farmerName || !mobileNo || !bookNo || !biltyNo) {
      toast.error('Please fill required fields');
      return;
    }

    toast.success('Farmer Payment saved! (Backend integration pending)');
    // Backend integration will be added
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className=\"flex items-center justify-center h-64\">
          <div className=\"spinner\"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className=\"animate-fade-in\">
        <div className=\"flex items-center justify-between mb-6\">
          <div>
            <h1 className=\"text-3xl font-bold\" style={{color: '#3E2723'}}>Farmer Payment</h1>
            <p className=\"text-sm\" style={{color: '#6B5846'}}>Record farmer purchases with payment voucher</p>
          </div>
          
          <div className=\"flex space-x-2\">
            <Button onClick={() => setShowForm(!showForm)} className=\"btn-primary\" data-testid=\"new-payment-button\">
              {showForm ? 'View List' : 'New Payment'}
            </Button>
          </div>
        </div>

        {showForm ? (
          <Card className=\"erp-card p-6\">
            {/* Header Section */}
            <div className=\"grid grid-cols-4 gap-4 mb-6 pb-6 border-b\">
              <div>
                <Label>Location *</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
              </div>
              <div>
                <Label>Anubandh/Sauda *</Label>
                <Input value={anubandh} onChange={(e) => setAnubandh(e.target.value)} required />
              </div>
              <div>
                <Label>Mandi/Godown *</Label>
                <Input value={mandiGodown} onChange={(e) => setMandiGodown(e.target.value)} required />
              </div>
              <div>
                <Label>Date *</Label>
                <Input type=\"date\" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              
              <div>
                <Label>Book No. *</Label>
                <Input value={bookNo} onChange={(e) => setBookNo(e.target.value)} required />
              </div>
              <div>
                <Label>Bilty No. *</Label>
                <Input value={biltyNo} onChange={(e) => setBiltyNo(e.target.value)} required />
              </div>
              <div>
                <Label>Tulai No. (Weighbridge)</Label>
                <Input value={tulaiNo} onChange={(e) => handleTulaiNoChange(e.target.value)} placeholder=\"Auto-fill\" />
              </div>
              <div>
                <Label>Token No.</Label>
                <Input value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} />
              </div>
            </div>

            {/* Farmer Details */}
            <h3 className=\"text-lg font-bold mb-4\" style={{color: '#3E2723'}}>Farmer Details</h3>
            <div className=\"grid grid-cols-4 gap-4 mb-6 pb-6 border-b\">
              <div>
                <Label>Farmer Name * (English)</Label>
                <Input value={farmerName} onChange={(e) => setFarmerName(e.target.value)} required />
              </div>
              <div>
                <Label>किसान का नाम (Hindi)</Label>
                <Input value={farmerNameHi} onChange={(e) => setFarmerNameHi(e.target.value)} />
              </div>
              <div>
                <Label>Mobile No. *</Label>
                <Input value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} required />
              </div>
              <div>
                <Label>Aadhaar No.</Label>
                <Input value={aadhaarNo} onChange={(e) => setAadhaarNo(e.target.value)} />
              </div>
              
              <div>
                <Label>City (English)</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label>शहर (Hindi)</Label>
                <Input value={cityHi} onChange={(e) => setCityHi(e.target.value)} />
              </div>
              <div>
                <Label>Agr. No.</Label>
                <Input value={agrNo} onChange={(e) => setAgrNo(e.target.value)} />
              </div>
              <div>
                <Label>ID No.</Label>
                <Input value={idNo} onChange={(e) => setIdNo(e.target.value)} />
              </div>
            </div>

            {/* Items Table */}
            <h3 className=\"text-lg font-bold mb-4\" style={{color: '#3E2723'}}>Items</h3>
            <div className=\"overflow-x-auto mb-6\">
              <table className=\"w-full border-collapse\">
                <thead>
                  <tr style={{background: 'linear-gradient(135deg, #6B8E23 0%, #5A7A1E 100%)'}}>
                    <th className=\"p-2 text-white text-sm\">#</th>
                    <th className=\"p-2 text-white text-sm\">Item *</th>
                    <th className=\"p-2 text-white text-sm\">Pack *</th>
                    <th className=\"p-2 text-white text-sm\">Bag</th>
                    <th className=\"p-2 text-white text-sm\">Kgs</th>
                    <th className=\"p-2 text-white text-sm\">Act. Kgs</th>
                    <th className=\"p-2 text-white text-sm\">Rate</th>
                    <th className=\"p-2 text-white text-sm\">Item Amt</th>
                    <th className=\"p-2 text-white text-sm\">Vehicle *</th>
                    <th className=\"p-2 text-white text-sm\">H+T</th>
                    <th className=\"p-2 text-white text-sm\">Total</th>
                    <th className=\"p-2 text-white text-sm\">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map((row, index) => (
                    <tr key={index} className=\"border-b\">
                      <td className=\"p-2 text-center\">{index + 1}</td>
                      <td className=\"p-2\">
                        <select
                          className=\"erp-select\"
                          value={row.itemId}
                          onChange={(e) => {
                            const item = items.find(i => i.id === e.target.value);
                            const newRows = [...itemRows];
                            newRows[index] = {
                              ...row,
                              itemId: e.target.value,
                              itemName: item?.name || '',
                              rate: item?.current_price || 0
                            };
                            setItemRows(newRows);
                            calculateItemRow(index, newRows);
                          }}
                        >
                          <option value=\"\">Select</option>
                          {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className=\"p-2\">
                        <Input className=\"w-24\" value={row.pack} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].pack = e.target.value;
                          setItemRows(newRows);
                        }} />
                      </td>
                      <td className=\"p-2\">
                        <Input className=\"w-20\" type=\"number\" value={row.bag} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].bag = parseFloat(e.target.value) || 0;
                          setItemRows(newRows);
                        }} />
                      </td>
                      <td className=\"p-2\">
                        <Input className=\"w-24\" type=\"number\" value={row.kgs} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].kgs = parseFloat(e.target.value) || 0;
                          setItemRows(newRows);
                          calculateItemRow(index, newRows);
                        }} />
                      </td>
                      <td className=\"p-2\">
                        <Input className=\"w-24\" type=\"number\" value={row.actKgs} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].actKgs = parseFloat(e.target.value) || 0;
                          setItemRows(newRows);
                          calculateItemRow(index, newRows);
                        }} />
                      </td>
                      <td className=\"p-2\">
                        <Input className=\"w-24\" type=\"number\" value={row.rate} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].rate = parseFloat(e.target.value) || 0;
                          setItemRows(newRows);
                          calculateItemRow(index, newRows);
                        }} />
                      </td>
                      <td className=\"p-2 font-bold\">₹{row.itemAmt.toFixed(2)}</td>
                      <td className=\"p-2\">
                        <Input className=\"w-24\" value={row.vehicle} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].vehicle = e.target.value;
                          setItemRows(newRows);
                        }} />
                      </td>
                      <td className=\"p-2\">
                        <Input className=\"w-24\" type=\"number\" value={row.htCharges} onChange={(e) => {
                          const newRows = [...itemRows];
                          newRows[index].htCharges = parseFloat(e.target.value) || 0;
                          setItemRows(newRows);
                          calculateItemRow(index, newRows);
                        }} />
                      </td>
                      <td className=\"p-2 font-bold\" style={{color: '#6B8E23'}}>₹{row.total.toFixed(2)}</td>
                      <td className=\"p-2 text-center\">
                        <Button size=\"sm\" onClick={() => removeItemRow(index)} className=\"text-red-600\">×</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button onClick={addItemRow} className=\"mt-2 btn-secondary\" size=\"sm\">+ Add Item</Button>
            </div>

            {/* Payment Section */}
            <h3 className=\"text-lg font-bold mb-4\" style={{color: '#3E2723'}}>Payment Details</h3>
            <div className=\"grid grid-cols-4 gap-4 mb-6\">
              <div>
                <Label>Type *</Label>
                <select className=\"erp-select\" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  <option value=\"cash\">Cash</option>
                  <option value=\"bank\">Bank</option>
                </select>
              </div>
              <div>
                <Label>Cash/Bank A/c *</Label>
                <Input value={cashBankAccount} onChange={(e) => setCashBankAccount(e.target.value)} />
              </div>
              <div>
                <Label>A/c No.</Label>
                <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
              </div>
              <div>
                <Label>Cash Amt.</Label>
                <Input type=\"number\" value={cashAmount} onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Bank Amt.</Label>
                <Input type=\"number\" value={bankAmount} onChange={(e) => setBankAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Additional Hammali</Label>
                <Input type=\"number\" value={additionalHammali} onChange={(e) => setAdditionalHammali(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Bank Charges</Label>
                <Input type=\"number\" value={bankCharges} onChange={(e) => setBankCharges(parseFloat(e.target.value) || 0)} />
              </div>
              <div className=\"flex items-end\">
                <div className=\"w-full p-3 rounded\" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                  <p className=\"text-sm\" style={{color: '#6B5846'}}>Total Amount</p>
                  <p className=\"text-2xl font-bold\" style={{color: '#6B8E23'}}>₹{totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className=\"flex justify-between mt-6 pt-6 border-t\">
              <div className=\"space-x-2\">
                <Button onClick={handleSave} className=\"btn-primary\">Save</Button>
                <Button onClick={() => setShowForm(false)} className=\"btn-secondary\">Cancel</Button>
              </div>
              <div className=\"space-x-2\">
                <Button className=\"btn-secondary\">Print (Mandi)</Button>
                <Button className=\"btn-secondary\">Print (Godown)</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className=\"erp-card\">
            <h2 className=\"text-xl font-bold mb-4\" style={{color: '#3E2723'}}>Farmer Payments List</h2>
            <div className=\"text-center py-12\" style={{color: '#6B5846'}}>
              {payments.length === 0 ? (
                <p>No farmer payments recorded yet. Click \"New Payment\" to create one.</p>
              ) : (
                <p>List view will be implemented</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default FarmerPaymentPage;
