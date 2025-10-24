import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function TransporterAutocomplete({ 
  value, 
  onSelect, 
  placeholder = "Type transporter name...",
  className = "",
  disabled = false 
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // New transporter modal
  const [showNewTransporterModal, setShowNewTransporterModal] = useState(false);
  const [newTransporterData, setNewTransporterData] = useState({
    name: '',
    contact: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    pan: '',
    gstin: ''
  });

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // Search transporters with debouncing
  const searchTransporters = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API}/transporters/search/${encodeURIComponent(query)}`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error searching transporters:', error);
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
      searchTransporters(query);
      setShowSuggestions(true);
    }, 300);
  };

  // Handle transporter selection
  const handleSelectTransporter = (transporter) => {
    setInputValue(transporter.name);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect({
      id: transporter.id,
      name: transporter.name,
      contact: transporter.contact,
      mobile: transporter.mobile,
      address: transporter.address,
      city: transporter.city,
      state: transporter.state
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
          handleSelectTransporter(suggestions[selectedIndex]);
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

  // Handle create new transporter
  const handleCreateNew = () => {
    setNewTransporterData(prev => ({ ...prev, name: inputValue.trim() }));
    setShowNewTransporterModal(true);
    setShowSuggestions(false);
  };

  // Handle new transporter creation
  const handleCreateNewTransporter = async () => {
    try {
      if (!newTransporterData.name?.trim()) {
        toast.error('Transporter name is required');
        return;
      }

      const response = await axios.post(`${API}/transporters`, newTransporterData);
      
      toast.success('New transporter created successfully!');
      handleSelectTransporter(response.data);
      setShowNewTransporterModal(false);
      
      // Reset form
      setNewTransporterData({
        name: '',
        contact: '',
        mobile: '',
        address: '',
        city: '',
        state: '',
        pan: '',
        gstin: ''
      });
      
    } catch (error) {
      console.error('Error creating transporter:', error);
      toast.error(error.response?.data?.detail || 'Failed to create transporter');
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
              {suggestions.map((transporter, index) => (
                <div
                  key={transporter.id}
                  className={`p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelectTransporter(transporter)}
                >
                  <div className="font-medium">{transporter.name}</div>
                  {(transporter.mobile || transporter.contact) && (
                    <div className="text-sm text-gray-600">
                      {transporter.mobile && `Mobile: ${transporter.mobile}`}
                      {transporter.mobile && transporter.contact && ' | '}
                      {transporter.contact && `Contact: ${transporter.contact}`}
                    </div>
                  )}
                  {(transporter.city || transporter.state) && (
                    <div className="text-sm text-gray-600">
                      {transporter.city}{transporter.city && transporter.state && ', '}{transporter.state}
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
                  Create new transporter "{inputValue.trim()}"
                </Button>
              </div>
            </>
          ) : inputValue.length >= 2 ? (
            <div className="p-3 text-center">
              <div className="text-gray-500 mb-2">No transporters found</div>
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

      {/* New Transporter Modal */}
      <Dialog open={showNewTransporterModal} onOpenChange={setShowNewTransporterModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Transporter</DialogTitle>
            <DialogDescription>
              Fill in transporter details. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-red-600">Transporter Name *</Label>
                  <Input
                    value={newTransporterData.name}
                    onChange={(e) => setNewTransporterData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter transporter name"
                  />
                </div>

                <div>
                  <Label>Contact Number</Label>
                  <Input
                    value={newTransporterData.contact}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setNewTransporterData(prev => ({ ...prev, contact: value }));
                    }}
                    placeholder="Office phone"
                    maxLength={15}
                  />
                </div>

                <div>
                  <Label>Mobile Number</Label>
                  <Input
                    value={newTransporterData.mobile}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setNewTransporterData(prev => ({ ...prev, mobile: value }));
                    }}
                    placeholder="10-digit mobile"
                    maxLength={10}
                  />
                </div>

                <div>
                  <Label>PAN</Label>
                  <Input
                    value={newTransporterData.pan}
                    onChange={(e) => setNewTransporterData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                  />
                </div>

                <div>
                  <Label>GSTIN</Label>
                  <Input
                    value={newTransporterData.gstin}
                    onChange={(e) => setNewTransporterData(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="font-semibold mb-3">Address Information</h3>
              <div className="space-y-3">
                <div>
                  <Label>Address</Label>
                  <Input
                    value={newTransporterData.address}
                    onChange={(e) => setNewTransporterData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input
                      value={newTransporterData.city}
                      onChange={(e) => setNewTransporterData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <Label>State</Label>
                    <Input
                      value={newTransporterData.state}
                      onChange={(e) => setNewTransporterData(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="State"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowNewTransporterModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleCreateNewTransporter}
                className="bg-green-600 hover:bg-green-700"
              >
                Create Transporter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TransporterAutocomplete;
