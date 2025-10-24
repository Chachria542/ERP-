import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

function BrokerAutocomplete({ 
  value, 
  onSelect, 
  placeholder = "Type broker name...",
  className = "",
  disabled = false 
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // New broker modal
  const [showNewBrokerModal, setShowNewBrokerModal] = useState(false);
  const [newBrokerData, setNewBrokerData] = useState({
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

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // Search brokers with debouncing
  const searchBrokers = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API}/brokers/search/${encodeURIComponent(query)}`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error searching brokers:', error);
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
      searchBrokers(query);
      setShowSuggestions(true);
    }, 300);
  };

  // Handle broker selection
  const handleSelectBroker = (broker) => {
    setInputValue(broker.name);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect({
      id: broker.id,
      name: broker.name,
      contact: broker.contact,
      default_brokerage_type: broker.default_brokerage_type,
      default_brokerage_rate: broker.default_brokerage_rate
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        handleCreateNew();
      }
      return;
    }

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
          handleSelectBroker(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          handleCreateNew();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle create new broker
  const handleCreateNew = () => {
    setNewBrokerData(prev => ({ ...prev, name: inputValue.trim() }));
    setShowNewBrokerModal(true);
    setShowSuggestions(false);
  };

  // Handle new broker creation
  const handleCreateNewBroker = async () => {
    try {
      console.log('[BrokerAutocomplete] Creating new broker:', newBrokerData);
      
      if (!newBrokerData.name?.trim()) {
        toast.error('Broker name is required');
        return;
      }

      const response = await axios.post(`${API}/brokers`, {
        ...newBrokerData,
        default_brokerage_rate: parseFloat(newBrokerData.default_brokerage_rate) || 0
      });
      
      toast.success('New broker created successfully!');
      handleSelectBroker(response.data);
      setShowNewBrokerModal(false);
      
      // Reset form
      setNewBrokerData({
        name: '',
        contact: '',
        pan: '',
        default_brokerage_type: 'per_quintal',
        default_brokerage_rate: ''
      });
      
    } catch (error) {
      console.error('[BrokerAutocomplete] Error creating broker:', error);
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to create broker');
      }
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target) &&
          suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {loading ? (
            <div className="p-3 text-gray-500 text-center">Searching...</div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((broker, index) => (
                <div
                  key={broker.id}
                  className={`p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelectBroker(broker)}
                >
                  <div className="font-medium">{broker.name}</div>
                  {broker.contact && (
                    <div className="text-sm text-gray-600">Contact: {broker.contact}</div>
                  )}
                  {broker.default_brokerage_type && (
                    <div className="text-sm text-gray-600">
                      Type: {broker.default_brokerage_type}, Rate: {broker.default_brokerage_rate || 0}
                    </div>
                  )}
                </div>
              ))}
              <div className="p-2 border-t border-gray-200 bg-gray-50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateNew}
                  className="w-full text-blue-600"
                >
                  Create new broker "{inputValue.trim()}"
                </Button>
              </div>
            </>
          ) : inputValue.length >= 2 ? (
            <div className="p-3 text-center">
              <div className="text-gray-500 mb-2">No brokers found</div>
              <Button
                size="sm"
                onClick={handleCreateNew}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create "{inputValue.trim()}"
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* New Broker Modal */}
      <Dialog open={showNewBrokerModal} onOpenChange={setShowNewBrokerModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Broker</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">* indicates required field</p>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-red-600">Broker Name *</Label>
              <Input
                value={newBrokerData.name}
                onChange={(e) => setNewBrokerData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter broker name"
              />
            </div>

            <div>
              <Label>Contact Number</Label>
              <Input
                value={newBrokerData.contact}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setNewBrokerData(prev => ({ ...prev, contact: value }));
                }}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
            </div>

            <div>
              <Label>PAN</Label>
              <Input
                value={newBrokerData.pan}
                onChange={(e) => setNewBrokerData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                placeholder="AAAAA0000A"
                maxLength={10}
              />
            </div>

            <div>
              <Label>Default Brokerage Type</Label>
              <Select
                value={newBrokerData.default_brokerage_type}
                onValueChange={(value) => setNewBrokerData(prev => ({ ...prev, default_brokerage_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROKERAGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Default Brokerage Rate</Label>
              <Input
                type="number"
                className="no-spinner"
                value={newBrokerData.default_brokerage_rate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setNewBrokerData(prev => ({ ...prev, default_brokerage_rate: value }));
                  }
                }}
                placeholder="0.00"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowNewBrokerModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleCreateNewBroker}
                className="bg-green-600 hover:bg-green-700"
              >
                Create Broker
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BrokerAutocomplete;
