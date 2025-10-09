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
  const [showForm, setShowForm] = useState(true);
  const [items, setItems] = useState([]);
  
  // Header fields
  const [location, setLocation] = useState('');
  const [anubandh, setAnubandh] = useState('');
  const [bookNo, setBookNo] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [mobileNo, setMobileNo] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API}/items`);
      setItems(res.data);
    } catch (error) {
      console.error('Failed to load items');
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold" style={{color: '#3E2723'}}>Farmer Payment</h1>
            <p className="text-sm mt-1" style={{color: '#6B5846'}}>Record purchases from farmers</p>
          </div>
          <Button className="btn-primary">New Payment</Button>
        </div>

        {showForm && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Payment Details</h2>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <Label>Location *</Label>
                <Input 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  placeholder="Enter location"
                  required 
                />
              </div>
              
              <div>
                <Label>Anubandh/Sauda *</Label>
                <Input 
                  value={anubandh} 
                  onChange={(e) => setAnubandh(e.target.value)} 
                  placeholder="Contract ref"
                  required 
                />
              </div>
              
              <div>
                <Label>Book No. *</Label>
                <Input 
                  value={bookNo} 
                  onChange={(e) => setBookNo(e.target.value)} 
                  placeholder="Book number"
                  required 
                />
              </div>
              
              <div>
                <Label>Date</Label>
                <Input 
                  type="date" 
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Farmer Details</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <Label>Farmer Name *</Label>
                <Input 
                  value={farmerName} 
                  onChange={(e) => setFarmerName(e.target.value)}
                  placeholder="Enter farmer name"
                  required 
                />
              </div>
              
              <div>
                <Label>Mobile No. *</Label>
                <Input 
                  value={mobileNo} 
                  onChange={(e) => setMobileNo(e.target.value)} 
                  placeholder="10 digit mobile"
                  required 
                />
              </div>
              
              <div>
                <Label>Aadhaar No.</Label>
                <Input placeholder="12 digit Aadhaar" />
              </div>
            </div>

            <h3 className="text-lg font-bold mb-4" style={{color: '#3E2723'}}>Items</h3>
            
            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse">
                <thead style={{background: 'linear-gradient(135deg, #6B8E23 0%, #5A7A1E 100%)'}}>
                  <tr>
                    <th className="p-3 text-white text-sm">#</th>
                    <th className="p-3 text-white text-sm">Item *</th>
                    <th className="p-3 text-white text-sm">Pack *</th>
                    <th className="p-3 text-white text-sm">Kgs</th>
                    <th className="p-3 text-white text-sm">Act. Kgs</th>
                    <th className="p-3 text-white text-sm">Rate</th>
                    <th className="p-3 text-white text-sm">Item Amt</th>
                    <th className="p-3 text-white text-sm">H+T</th>
                    <th className="p-3 text-white text-sm">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 text-center">1</td>
                    <td className="p-2">
                      <select className="erp-select w-full">
                        <option value="">Select Item</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2"><Input className="w-24" placeholder="Pack" /></td>
                    <td className="p-2"><Input className="w-24" type="number" placeholder="0" /></td>
                    <td className="p-2"><Input className="w-24" type="number" placeholder="0" /></td>
                    <td className="p-2"><Input className="w-24" type="number" placeholder="0" /></td>
                    <td className="p-2 font-bold" style={{color: '#6B8E23'}}>₹0.00</td>
                    <td className="p-2"><Input className="w-24" type="number" placeholder="0" /></td>
                    <td className="p-2 font-bold" style={{color: '#6B8E23'}}>₹0.00</td>
                  </tr>
                </tbody>
              </table>
              <Button className="mt-2 btn-secondary" size="sm">+ Add Item</Button>
            </div>

            <div className="flex justify-between mt-6 pt-6 border-t">
              <div className="space-x-2">
                <Button className="btn-primary">Save</Button>
                <Button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
              <div className="space-x-2">
                <Button className="btn-secondary">Print (Mandi)</Button>
                <Button className="btn-secondary">Print (Godown)</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default FarmerPaymentPage;