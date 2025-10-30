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
  const [editingParty, setEditingParty] = useState(null);

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
      if (editingParty) {
        // Update existing party
        await axios.put(`${API}/parties/${editingParty.id}`, {
          name: partyName,
          type: partyType,
          contact: partyContact || null,
          address: partyAddress || null,
          gstin: partyGstin || null
        });
        toast.success('Party updated successfully!');
      } else {
        // Create new party
        await axios.post(`${API}/parties`, {
          name: partyName,
          type: partyType,
          contact: partyContact || null,
          address: partyAddress || null,
          gstin: partyGstin || null
        });
        toast.success('Party created successfully!');
      }
      
      setShowPartyDialog(false);
      setEditingParty(null);
      // Reset form
      setPartyName('');
      setPartyType('farmer');
      setPartyContact('');
      setPartyAddress('');
      setPartyGstin('');
      fetchData();
    } catch (error) {
      toast.error(editingParty ? 'Failed to update party' : 'Failed to create party');
    }
  };

  const handleEditParty = (party) => {
    setEditingParty(party);
    setPartyName(party.name);
    setPartyType(party.type || 'farmer');
    setPartyContact(party.contact || '');
    setPartyAddress(party.address || '');
    setPartyGstin(party.gstin || '');
    setShowPartyDialog(true);
  };

  const handleDeleteParty = async (partyId) => {
    if (!window.confirm('Are you sure you want to delete this party?')) return;
    
    try {
      await axios.delete(`${API}/parties/${partyId}`);
      toast.success('Party deleted successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete party');
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
              <Dialog open={showPartyDialog} onOpenChange={(open) => {
                setShowPartyDialog(open);
                if (!open) {
                  setEditingParty(null);
                  setPartyName('');
                  setPartyType('farmer');
                  setPartyContact('');
                  setPartyAddress('');
                  setPartyGstin('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-primary" data-testid="add-party-button">
                    Add Party
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingParty ? 'Edit Party' : 'Add New Party'}</DialogTitle>
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
                      <th>Roles</th>
                      <th>Contact</th>
                      <th>Village/City</th>
                      <th>GSTIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map(party => (
                      <tr key={party.id}>
                        <td className="font-semibold">{party.name}</td>
                        <td>
                          {party.roles && party.roles.length > 0 ? (
                            party.roles.map(role => (
                              <span key={role} className="badge badge-info capitalize mr-1">{role}</span>
                            ))
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td>{party.contact || '-'}</td>
                        <td>{party.city || '-'}</td>
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

          <TabsContent value="brokers">
            <div className="flex justify-end mb-4">
              <Dialog open={showBrokerDialog} onOpenChange={(open) => {
                setShowBrokerDialog(open);
                if (!open) {
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
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-primary" data-testid="add-broker-button">
                    Add Broker
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingBroker ? 'Edit Broker' : 'Add New Broker'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSaveBroker} className="space-y-4">
                    {/* Basic Information */}
                    <div className="border-b pb-4">
                      <h3 className="font-semibold mb-3">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Broker Name *</Label>
                          <Input 
                            value={brokerData.name} 
                            onChange={(e) => setBrokerData({...brokerData, name: e.target.value})} 
                            required 
                          />
                        </div>
                        <div>
                          <Label>Phone Number</Label>
                          <Input 
                            value={brokerData.phone} 
                            onChange={(e) => setBrokerData({...brokerData, phone: e.target.value})} 
                          />
                        </div>
                        <div>
                          <Label>Mobile Number</Label>
                          <Input 
                            value={brokerData.mobile} 
                            onChange={(e) => setBrokerData({...brokerData, mobile: e.target.value})} 
                          />
                        </div>
                        <div>
                          <Label>PAN</Label>
                          <Input 
                            value={brokerData.pan} 
                            onChange={(e) => setBrokerData({...brokerData, pan: e.target.value.toUpperCase()})} 
                            maxLength={10}
                          />
                        </div>
                        <div>
                          <Label>GSTIN</Label>
                          <Input 
                            value={brokerData.gstin} 
                            onChange={(e) => setBrokerData({...brokerData, gstin: e.target.value.toUpperCase()})} 
                            maxLength={15}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="border-b pb-4">
                      <h3 className="font-semibold mb-3">Address Information</h3>
                      <div className="space-y-3">
                        <div>
                          <Label>Address</Label>
                          <Input 
                            value={brokerData.address} 
                            onChange={(e) => setBrokerData({...brokerData, address: e.target.value})} 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>City</Label>
                            <Input 
                              value={brokerData.city} 
                              onChange={(e) => setBrokerData({...brokerData, city: e.target.value})} 
                            />
                          </div>
                          <div>
                            <Label>State</Label>
                            <Input 
                              value={brokerData.state} 
                              onChange={(e) => setBrokerData({...brokerData, state: e.target.value})} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Brokerage Details */}
                    <div>
                      <h3 className="font-semibold mb-3">Default Brokerage Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Brokerage Type</Label>
                          <select 
                            value={brokerData.default_brokerage_type} 
                            onChange={(e) => setBrokerData({...brokerData, default_brokerage_type: e.target.value})} 
                            className="erp-select"
                          >
                            <option value="per_quintal">Per Quintal</option>
                            <option value="per_bag">Per Bag</option>
                            <option value="percentage">Percentage</option>
                          </select>
                        </div>
                        <div>
                          <Label>Brokerage Rate</Label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={brokerData.default_brokerage_rate} 
                            onChange={(e) => setBrokerData({...brokerData, default_brokerage_rate: e.target.value})} 
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full btn-primary">
                      {editingBroker ? 'Update Broker' : 'Add Broker'}
                    </Button>
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
                      <th>Phone/Mobile</th>
                      <th>City/State</th>
                      <th>GSTIN</th>
                      <th>Brokerage</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-gray-500 py-8">
                          No brokers found. Click "Add Broker" to create one.
                        </td>
                      </tr>
                    ) : (
                      brokers.map(broker => (
                        <tr key={broker.id}>
                          <td className="font-semibold">{broker.name}</td>
                          <td>
                            {broker.mobile && <div>{broker.mobile}</div>}
                            {broker.phone && <div className="text-sm text-gray-600">{broker.phone}</div>}
                            {!broker.mobile && !broker.phone && '-'}
                          </td>
                          <td>
                            {broker.city || broker.state ? (
                              <>
                                {broker.city}{broker.city && broker.state && ', '}{broker.state}
                              </>
                            ) : '-'}
                          </td>
                          <td>{broker.gstin || '-'}</td>
                          <td>
                            <div className="text-sm">
                              {broker.default_brokerage_type && (
                                <>
                                  <span className="capitalize">{broker.default_brokerage_type.replace('_', ' ')}</span>
                                  {broker.default_brokerage_rate && `: ${broker.default_brokerage_rate}`}
                                </>
                              )}
                              {!broker.default_brokerage_type && '-'}
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditBroker(broker)}
                                className="text-blue-600"
                              >
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDeleteBroker(broker.id)}
                                className="text-red-600"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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