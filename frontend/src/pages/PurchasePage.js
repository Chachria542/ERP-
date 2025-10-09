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

function PurchasePage({ user, onLogout }) {
  const [showForm, setShowForm] = useState(true);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [brokers, setBrokers] = useState([]);
  
  // Header fields
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseType, setPurchaseType] = useState('direct');
  const [mandiGodown, setMandiGodown] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [brokerageType, setBrokerageType] = useState('');
  const [brokerageRate, setBrokerageRate] = useState(0);
  
  // Transaction fields
  const [challanNo, setChallanNo] = useState('');
  const [declarationNo, setDeclarationNo] = useState('');
  const [declarationDate, setDeclarationDate] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [agrNo, setAgrNo] = useState('');
  const [agrDate, setAgrDate] = useState('');
  const [remark, setRemark] = useState('');
  
  // Item rows
  const [itemRows, setItemRows] = useState([{
    itemId: '', itemName: '', marka: '', bag: 0, kgs: 0, pack: 0,
    calWt: 0, actWt: 0, agrWt: 0, rate: 0, amount: 0, agrAmt: 0, bardan: 0,
    cgstPercent: 0, cgstAmt: 0, sgstPercent: 0, sgstAmt: 0, itemTotal: 0
  }]);
  
  // Footer calculations
  const [batavPercent, setBatavPercent] = useState(0);
  const [batavAmt, setBatavAmt] = useState(0);
  const [shortagePercent, setShortagePercent] = useState(0);
  const [shortageAmt, setShortageAmt] = useState(0);
  const [pending, setPending] = useState(0);
  const [claim, setClaim] = useState(0);
  const [netAmount, setNetAmount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateNetAmount();
  }, [itemRows, batavAmt, shortageAmt, pending, claim]);

  const fetchData = async () => {
    try {
      const [itemsRes, partiesRes] = await Promise.all([
        axios.get(`${API}/items`),
        axios.get(`${API}/parties`)
      ]);
      
      setItems(itemsRes.data);
      setSuppliers(partiesRes.data.filter(p => p.type === 'supplier'));
      setBrokers(partiesRes.data.filter(p => p.type === 'broker'));
    } catch (error) {
      console.error('Failed to load data');
    }
  };

  const calculateItemRow = (index, rows = itemRows) => {
    const row = rows[index];
    const amount = row.rate * (row.actWt || 0);
    const cgstAmt = (row.cgstPercent / 100) * amount;
    const sgstAmt = (row.sgstPercent / 100) * amount;
    const itemTotal = amount + cgstAmt + sgstAmt + row.bardan;
    
    const newRows = [...rows];
    newRows[index] = {
      ...row,
      amount: amount,
      cgstAmt: cgstAmt,
      sgstAmt: sgstAmt,
      itemTotal: itemTotal
    };
    setItemRows(newRows);
  };

  const calculateNetAmount = () => {
    const itemsTotal = itemRows.reduce((sum, row) => sum + row.itemTotal, 0);
    const net = itemsTotal - batavAmt - shortageAmt + claim - pending;
    setNetAmount(net);
  };

  const addItemRow = () => {
    setItemRows([...itemRows, {
      itemId: '', itemName: '', marka: '', bag: 0, kgs: 0, pack: 0,
      calWt: 0, actWt: 0, agrWt: 0, rate: 0, amount: 0, agrAmt: 0, bardan: 0,
      cgstPercent: 0, cgstAmt: 0, sgstPercent: 0, sgstAmt: 0, itemTotal: 0
    }]);
  };

  const removeItemRow = (index) => {
    if (itemRows.length > 1) {
      const newRows = itemRows.filter((_, i) => i !== index);
      setItemRows(newRows);
    }
  };

  const handleSave = async () => {
    if (!billNo || !supplierId) {
      toast.error('Please fill required fields');
      return;
    }
    toast.success('Bill Purchase saved! (Backend integration pending)');
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold" style={{color: '#3E2723'}}>Bill Purchase</h1>
            <p className="text-sm mt-1" style={{color: '#6B5846'}}>Record purchases from suppliers with GST</p>
          </div>
          <Button className="btn-primary">New Purchase</Button>
        </div>

        {showForm && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Purchase Details</h2>
            
            {/* Header Section */}
            <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div>
                <Label>Bill No. *</Label>
                <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} required />
              </div>
              <div>
                <Label>Bill Date *</Label>
                <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required />
              </div>
              <div>
                <Label>Type</Label>
                <select className="erp-select" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}>
                  <option value="direct">Direct</option>
                  <option value="godown">Godown</option>
                </select>
              </div>
              
              <div>
                <Label>Mandi/Godown *</Label>
                <Input value={mandiGodown} onChange={(e) => setMandiGodown(e.target.value)} required />
              </div>
              <div>
                <Label>Supplier *</Label>
                <select className="erp-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Broker</Label>
                <select className="erp-select" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
                  <option value="">Select Broker</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Brokerage Rate</Label>
                <Input type="number" value={brokerageRate} onChange={(e) => setBrokerageRate(parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            {/* Transaction Info */}
            <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Transaction Details</h3>
            <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b">
              <div>
                <Label>Challan No.</Label>
                <Input value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
              </div>
              <div>
                <Label>Declaration No.</Label>
                <Input value={declarationNo} onChange={(e) => setDeclarationNo(e.target.value)} />
              </div>
              <div>
                <Label>Declaration Date</Label>
                <Input type="date" value={declarationDate} onChange={(e) => setDeclarationDate(e.target.value)} />
              </div>
              <div>
                <Label>Vehicle</Label>
                <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
              </div>
              <div>
                <Label>Agr. No.</Label>
                <Input value={agrNo} onChange={(e) => setAgrNo(e.target.value)} />
              </div>
              <div>
                <Label>Agr. Date</Label>
                <Input type="date" value={agrDate} onChange={(e) => setAgrDate(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Remark</Label>
                <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
              </div>
            </div>

            {/* Items Table */}
            <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Items</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse text-sm">
                <thead style={{background: 'linear-gradient(135deg, #6B8E23 0%, #5A7A1E 100%)'}}>
                  <tr>
                    <th className="p-2 text-white">#</th>
                    <th className="p-2 text-white">Item</th>
                    <th className="p-2 text-white">Marka</th>
                    <th className="p-2 text-white">Bag</th>
                    <th className="p-2 text-white">Kgs</th>
                    <th className="p-2 text-white">Act. Wt.</th>
                    <th className="p-2 text-white">Rate</th>
                    <th className="p-2 text-white">Amount</th>
                    <th className="p-2 text-white">Bardan</th>
                    <th className="p-2 text-white">CGST %</th>
                    <th className="p-2 text-white">CGST Amt</th>
                    <th className="p-2 text-white">SGST %</th>
                    <th className="p-2 text-white">SGST Amt</th>
                    <th className="p-2 text-white">Total</th>
                    <th className="p-2 text-white">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 text-center">{index + 1}</td>
                      <td className="p-2">
                        <select className="erp-select w-32" value={row.itemId} onChange={(e) => {
                          const item = items.find(i => i.id === e.target.value);
                          const newRows = [...itemRows];
                          newRows[index] = {...row, itemId: e.target.value, itemName: item?.name || '', rate: item?.current_price || 0};
                          setItemRows(newRows);
                          calculateItemRow(index, newRows);
                        }}>
                          <option value="">Select</option>
                          {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><Input className="w-20" value={row.marka} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].marka = e.target.value; setItemRows(newRows);
                      }} /></td>
                      <td className="p-2"><Input className="w-16" type="number" value={row.bag} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].bag = parseFloat(e.target.value) || 0; setItemRows(newRows);
                      }} /></td>
                      <td className="p-2"><Input className="w-20" type="number" value={row.kgs} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].kgs = parseFloat(e.target.value) || 0; setItemRows(newRows);
                      }} /></td>
                      <td className="p-2"><Input className="w-20" type="number" value={row.actWt} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].actWt = parseFloat(e.target.value) || 0; setItemRows(newRows); calculateItemRow(index, newRows);
                      }} /></td>
                      <td className="p-2"><Input className="w-20" type="number" value={row.rate} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].rate = parseFloat(e.target.value) || 0; setItemRows(newRows); calculateItemRow(index, newRows);
                      }} /></td>
                      <td className="p-2 font-bold">₹{row.amount.toFixed(0)}</td>
                      <td className="p-2"><Input className="w-20" type="number" value={row.bardan} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].bardan = parseFloat(e.target.value) || 0; setItemRows(newRows); calculateItemRow(index, newRows);
                      }} /></td>
                      <td className="p-2"><Input className="w-16" type="number" value={row.cgstPercent} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].cgstPercent = parseFloat(e.target.value) || 0; setItemRows(newRows); calculateItemRow(index, newRows);
                      }} /></td>
                      <td className="p-2 font-bold">₹{row.cgstAmt.toFixed(0)}</td>
                      <td className="p-2"><Input className="w-16" type="number" value={row.sgstPercent} onChange={(e) => {
                        const newRows = [...itemRows]; newRows[index].sgstPercent = parseFloat(e.target.value) || 0; setItemRows(newRows); calculateItemRow(index, newRows);
                      }} /></td>
                      <td className="p-2 font-bold">₹{row.sgstAmt.toFixed(0)}</td>
                      <td className="p-2 font-bold" style={{color: '#6B8E23'}}>₹{row.itemTotal.toFixed(0)}</td>
                      <td className="p-2"><Button size="sm" onClick={() => removeItemRow(index)} className="text-red-600">×</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button onClick={addItemRow} className="mt-2 btn-secondary" size="sm">+ Add Item</Button>
            </div>

            {/* Footer Calculations */}
            <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-t pt-6">
              <div>
                <Label>Batav %</Label>
                <Input type="number" value={batavPercent} onChange={(e) => setBatavPercent(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Batav Amt</Label>
                <Input type="number" value={batavAmt} onChange={(e) => setBatavAmt(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Shortage %</Label>
                <Input type="number" value={shortagePercent} onChange={(e) => setShortagePercent(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Shortage Amt</Label>
                <Input type="number" value={shortageAmt} onChange={(e) => setShortageAmt(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Pending</Label>
                <Input type="number" value={pending} onChange={(e) => setPending(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Claim</Label>
                <Input type="number" value={claim} onChange={(e) => setClaim(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <div className="p-4 rounded" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                  <p className="text-sm" style={{color: '#6B5846'}}>Net Amount</p>
                  <p className="text-3xl font-bold" style={{color: '#6B8E23'}}>₹{netAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <div className="space-x-2">
                <Button onClick={handleSave} className="btn-primary">Save</Button>
                <Button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
              <Button className="btn-secondary">Print</Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default PurchasePage;