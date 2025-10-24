import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function CustomerAutocomplete({ 
  value, 
  onSelect, 
  placeholder = "Type customer name...",
  className = "",
  disabled = false 
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Modal for new customer
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  
  // New customer form
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    gstin: '',
    place_of_supply: '',
    contact: '',
    state: '',
    address: '',
    city: '',
    pin_code: '',
    state_code: ''
  });

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // Search customers with debouncing
  const searchCustomers = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      // Fetch all parties and filter customers
      const response = await axios.get(`${API}/parties`);
      const customers = response.data.filter(party => 
        party.roles && party.roles.includes('customer')
      );
      
      // Filter by search query
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(query.toLowerCase()) ||
        (customer.gstin && customer.gstin.toLowerCase().includes(query.toLowerCase())) ||
        (customer.contact && customer.contact.includes(query))
      );
      
      setSuggestions(filtered);
    } catch (error) {
      console.error('Error searching customers:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const query = e.target.value;
    setInputValue(query);
    setSelectedIndex(-1);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchCustomers(query);
      setShowSuggestions(true);
    }, 300);
  };

  // Handle customer selection
  const handleSelectCustomer = (customer) => {
    setInputValue(customer.name);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect({
      id: customer.id,
      name: customer.name,
      gstin: customer.gstin || '',
      place_of_supply: customer.place_of_supply || '',
      state: customer.state || '',
      contact: customer.contact || ''
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectCustomer(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  // Handle "Add as New Customer"
  const handleAddNewCustomer = () => {
    setNewCustomerData({
      name: inputValue,
      gstin: '',
      place_of_supply: '',
      contact: '',
      state: '',
      address: '',
      city: '',
      pin_code: '',
      state_code: ''
    });
    setShowNewCustomerModal(true);
    setShowSuggestions(false);
  };

  // Auto-extract state_code from GSTIN
  const handleGstinChange = (value) => {
    setNewCustomerData({
      ...newCustomerData, 
      gstin: value,
      state_code: value.length >= 2 ? value.substring(0, 2) : newCustomerData.state_code
    });
  };

  // Create new customer
  const createNewCustomer = async () => {
    try {
      if (!newCustomerData.name || !newCustomerData.place_of_supply) {
        toast.error('Customer Name and Place of Supply are required');
        return;
      }

      const payload = {
        name: newCustomerData.name,
        gstin: newCustomerData.gstin || null,
        place_of_supply: newCustomerData.place_of_supply,
        contact: newCustomerData.contact || null,
        state: newCustomerData.state || null,
        address: newCustomerData.address || null,
        roles: ['customer']
      };

      const response = await axios.post(`${API}/parties`, payload);
      
      toast.success(`Customer "${response.data.name}" created successfully`);
      
      // Select the newly created customer
      handleSelectCustomer(response.data);
      
      // Close modal and reset
      setShowNewCustomerModal(false);
      setNewCustomerData({
        name: '',
        gstin: '',
        place_of_supply: '',
        contact: '',
        state: '',
        address: ''
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error(error.response?.data?.detail || 'Failed to create customer');
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current && !inputRef.current.contains(event.target) &&
        suggestionsRef.current && !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
        />

        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {loading ? (
              <div className="p-3 text-center text-gray-500">Searching...</div>
            ) : suggestions.length > 0 ? (
              <>
                {suggestions.map((customer, index) => (
                  <div
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className={`p-3 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 ${
                      index === selectedIndex ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-600">
                      {customer.gstin && <span>GSTIN: {customer.gstin}</span>}
                      {customer.place_of_supply && <span className="ml-2">• {customer.place_of_supply}</span>}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddNewCustomer}
                  className="w-full p-3 text-left text-blue-600 hover:bg-blue-50 border-t font-medium"
                >
                  + Add as New Customer
                </button>
              </>
            ) : inputValue.length >= 2 ? (
              <div className="p-3">
                <div className="text-gray-500 mb-2">No customers found</div>
                <button
                  type="button"
                  onClick={handleAddNewCustomer}
                  className="w-full p-2 text-left text-blue-600 hover:bg-blue-50 rounded font-medium"
                >
                  + Add as New Customer
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      <Dialog open={showNewCustomerModal} onOpenChange={setShowNewCustomerModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({...newCustomerData, name: e.target.value})}
                  placeholder="Enter customer name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>GSTIN</Label>
                <Input
                  value={newCustomerData.gstin}
                  onChange={(e) => setNewCustomerData({...newCustomerData, gstin: e.target.value})}
                  placeholder="Enter GSTIN"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Place of Supply *</Label>
                <Input
                  value={newCustomerData.place_of_supply}
                  onChange={(e) => setNewCustomerData({...newCustomerData, place_of_supply: e.target.value})}
                  placeholder="e.g., Mumbai, Maharashtra"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Mobile Number</Label>
                <Input
                  value={newCustomerData.contact}
                  onChange={(e) => setNewCustomerData({...newCustomerData, contact: e.target.value})}
                  placeholder="10-digit mobile"
                  className="mt-1"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Input
                  value={newCustomerData.state}
                  onChange={(e) => setNewCustomerData({...newCustomerData, state: e.target.value})}
                  placeholder="e.g., Maharashtra"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Address</Label>
                <Input
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({...newCustomerData, address: e.target.value})}
                  placeholder="Enter address"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewCustomerModal(false);
                  setNewCustomerData({
                    name: '',
                    gstin: '',
                    place_of_supply: '',
                    contact: '',
                    state: '',
                    address: ''
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={createNewCustomer}
              >
                Create Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CustomerAutocomplete;
