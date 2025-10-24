import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function MasterDataPage({ user, onLogout }) {
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPartyDialog, setShowPartyDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingBroker, setEditingBroker] = useState(null);

  // Party form
  const [partyName, setPartyName] = useState('');
  const [partyType, setPartyType] = useState('farmer');
  const [partyContact, setPartyContact] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyGstin, setPartyGstin] = useState('');

  // Item form
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('wheat');
  const [itemUnit, setItemUnit] = useState('kg');
  const [itemPrice, setItemPrice] = useState('');

  // Price update
  const [newPrice, setNewPrice] = useState('');
  
  // Broker form
  const [brokerData, setBrokerData] = useState({
    name: '',
    phone: '',
    mobile: '',
    pan: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    default_brokerage_type: 'per_quintal',
    default_brokerage_rate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [partiesRes, itemsRes, brokersRes] = await Promise.all([
        axios.get(`${API}/parties`),
        axios.get(`${API}/items`),
        axios.get(`${API}/brokers`)
      ]);
      
      setParties(partiesRes.data);
      setItems(itemsRes.data);
      setBrokers(brokersRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParty = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/parties`, {
        name: partyName,
        type: partyType,
        contact: partyContact || null,
        address: partyAddress || null,
        gstin: partyGstin || null
      });
      
      toast.success('Party created successfully!');
      setShowPartyDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create party');
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/items`, {
        name: itemName,
        category: itemCategory,
        unit: itemUnit,
        current_price: parseFloat(itemPrice)
      });
      
      toast.success('Item created successfully!');
      setShowItemDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create item');
    }
  };

  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API}/items/${selectedItem.id}/price?new_price=${parseFloat(newPrice)}`);
      
      toast.success('Price updated and LTV recalculated!');
      setShowPriceDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update price');
    }
  };
  
  const handleSaveBroker = async (e) => {
    e.preventDefault();
    
    try {
      if (editingBroker) {
        // Update existing broker
        await axios.put(`${API}/brokers/${editingBroker.id}`, brokerData);
        toast.success('Broker updated successfully!');
      } else {
        // Create new broker
        await axios.post(`${API}/brokers`, brokerData);
        toast.success('Broker created successfully!');
      }
      
      setShowBrokerDialog(false);
      setEditingBroker(null);
      setBrokerData({
        name: '',
        phone: '',
        mobile: '',
        pan: '',
        gstin: '',
        address: '',
        city: '',
        state: '',
        default_brokerage_type: 'per_quintal',
        default_brokerage_rate: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to save broker');
    }
  };
  
  const handleEditBroker = (broker) => {
    setEditingBroker(broker);
    setBrokerData({
      name: broker.name,
      phone: broker.phone || '',
      mobile: broker.mobile || '',
      pan: broker.pan || '',
      gstin: broker.gstin || '',
      address: broker.address || '',
      city: broker.city || '',
      state: broker.state || '',
      default_brokerage_type: broker.default_brokerage_type || 'per_quintal',
      default_brokerage_rate: broker.default_brokerage_rate || ''
    });
    setShowBrokerDialog(true);
  };
  
  const handleDeleteBroker = async (brokerId) => {
    if (!window.confirm('Are you sure you want to delete this broker?')) return;
    
    try {
      await axios.delete(`${API}/brokers/${brokerId}`);
      toast.success('Broker deleted successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete broker');
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Master Data</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Manage parties, items, and prices</p>
        </div>

        <Tabs defaultValue="parties" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="parties" data-testid="parties-tab">Parties</TabsTrigger>
            <TabsTrigger value="items" data-testid="items-tab">Items</TabsTrigger>
            <TabsTrigger value="brokers" data-testid="brokers-tab">Brokers</TabsTrigger>
          </TabsList>

          <TabsContent value="parties">
            <div className="flex justify-end mb-4">
              <Dialog open={showPartyDialog} onOpenChange={setShowPartyDialog}>
                <DialogTrigger asChild>
                  <Button className="btn-primary" data-testid="add-party-button">
                    Add Party
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Party</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateParty} className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} required />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select value={partyType} onChange={(e) => setPartyType(e.target.value)} className="erp-select">
                        <option value="farmer">Farmer</option>
                        <option value="supplier">Supplier</option>
                        <option value="buyer">Buyer</option>
                        <option value="broker">Broker</option>
                      </select>
                    </div>
                    <div>
                      <Label>Contact</Label>
                      <Input value={partyContact} onChange={(e) => setPartyContact(e.target.value)} />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} />
                    </div>
                    <div>
                      <Label>GSTIN</Label>
                      <Input value={partyGstin} onChange={(e) => setPartyGstin(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full btn-primary">Add Party</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="erp-card">
              <div className="overflow-x-auto">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Contact</th>
                      <th>Address</th>
                      <th>GSTIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map(party => (
                      <tr key={party.id}>
                        <td className="font-semibold">{party.name}</td>
                        <td><span className="badge badge-info capitalize">{party.type}</span></td>
                        <td>{party.contact || '-'}</td>
                        <td>{party.address || '-'}</td>
                        <td>{party.gstin || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="items">
            <div className="flex justify-end mb-4">
              <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
                <DialogTrigger asChild>
                  <Button className="btn-primary" data-testid="add-item-button">
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Item</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateItem} className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} required />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} required />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="erp-select">
                        <option value="kg">Kilogram (kg)</option>
                        <option value="quintal">Quintal</option>
                        <option value="ton">Ton</option>
                      </select>
                    </div>
                    <div>
                      <Label>Current Price (₹/{itemUnit})</Label>
                      <Input type="number" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full btn-primary">Add Item</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="erp-card">
              <div className="overflow-x-auto">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Current Price</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.name}</td>
                        <td className="capitalize">{item.category}</td>
                        <td>{item.unit}</td>
                        <td className="font-bold" style={{color: '#6B8E23'}}>
                          ₹{item.current_price.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setNewPrice(item.current_price.toString());
                              setShowPriceDialog(true);
                            }}
                            className="btn-secondary"
                            data-testid={`update-price-${item.id}`}
                          >
                            Update Price
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Price Update Dialog */}
        <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Update Item Price</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <form onSubmit={handleUpdatePrice} className="space-y-4">
                <div className="p-4 rounded-lg" style={{background: '#F5E6D3'}}>
                  <p className="text-sm" style={{color: '#6B5846'}}>Item</p>
                  <p className="font-bold text-lg mb-2" style={{color: '#3E2723'}}>{selectedItem.name}</p>
                  <p className="text-sm" style={{color: '#6B5846'}}>Current Price</p>
                  <p className="font-bold text-xl" style={{color: '#6B8E23'}}>
                    ₹{selectedItem.current_price.toLocaleString('en-IN')} / {selectedItem.unit}
                  </p>
                </div>

                <div>
                  <Label>New Price (₹/{selectedItem.unit})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    required
                    data-testid="new-price-input"
                  />
                </div>

                <div className="p-4 rounded-lg" style={{background: 'rgba(218, 165, 32, 0.1)'}}>
                  <p className="text-sm font-semibold" style={{color: '#DAA520'}}>Note:</p>
                  <p className="text-sm" style={{color: '#3E2723'}}>
                    Updating the price will automatically recalculate LTV for all custody lots with this item.
                  </p>
                </div>

                <Button type="submit" className="w-full btn-primary" data-testid="submit-price-update">
                  Update Price
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default MasterDataPage;