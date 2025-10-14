import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function SupplierAutocomplete({ 
  value, 
  onSelect, 
  placeholder = "Type supplier name...",
  className = "",
  disabled = false 
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Modals
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [similarSuppliers, setSimilarSuppliers] = useState([]);
  
  // New supplier form
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    gstin: '',
    place_of_supply: '',
    contact: '',
    state: '',
    address: '',
    pan: ''
  });

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // Search suppliers with debouncing
  const searchSuppliers = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API}/suppliers/search?q=${encodeURIComponent(query)}`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error searching suppliers:', error);
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
      searchSuppliers(query);
      setShowSuggestions(true);
    }, 300);
  };

  // Handle supplier selection
  const handleSelectSupplier = (supplier) => {
    setInputValue(supplier.name);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect({
      id: supplier.id,
      name: supplier.name,
      gstin: supplier.gstin,
      place_of_supply: supplier.place_of_supply,
      state: supplier.state,
      contact: supplier.contact
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        // No suggestions found, show options
        handleNoMatchFound();
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
          handleSelectSupplier(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          handleNoMatchFound();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle no match found
  const handleNoMatchFound = () => {
    if (!inputValue.trim()) return;
    
    // Check if there are similar suppliers
    const similar = suggestions.filter(s => 
      s.similarity_score > 0.3 || 
      s.name.toLowerCase().includes(inputValue.toLowerCase())
    );
    
    if (similar.length > 0) {
      setSimilarSuppliers(similar);
      setShowReplaceModal(true);
    } else {
      // No similar suppliers, offer to create new
      setNewSupplierData(prev => ({ ...prev, name: inputValue.trim() }));
      setShowNewSupplierModal(true);
    }
  };

  // Handle new supplier creation
  const handleCreateNewSupplier = async () => {
    try {
      if (!newSupplierData.name || !newSupplierData.gstin || 
          !newSupplierData.place_of_supply || !newSupplierData.contact) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await axios.post(`${API}/suppliers/quick-create`, newSupplierData);
      
      toast.success('New supplier created successfully!');
      handleSelectSupplier(response.data);
      setShowNewSupplierModal(false);
      
      // Reset form
      setNewSupplierData({
        name: '',
        gstin: '',
        place_of_supply: '',
        contact: '',
        state: '',
        address: '',
        pan: ''
      });
      
    } catch (error) {
      console.error('Error creating supplier:', error);
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to create supplier');
      }
    }
  };

  // Handle replace existing supplier
  const handleReplaceSupplier = async (supplier) => {
    try {
      await axios.put(`${API}/suppliers/${supplier.id}/name`, {}, {
        params: { new_name: inputValue.trim() }
      });
      
      toast.success(`Supplier name updated to: ${inputValue.trim()}`);
      handleSelectSupplier({
        ...supplier,
        name: inputValue.trim()
      });
      setShowReplaceModal(false);
      
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast.error('Failed to update supplier name');
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
              {suggestions.map((supplier, index) => (
                <div
                  key={supplier.id}
                  className={`p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelectSupplier(supplier)}
                >
                  <div className="font-medium">{supplier.name}</div>
                  {supplier.gstin && (
                    <div className="text-sm text-gray-600">GSTIN: {supplier.gstin}</div>
                  )}
                  {supplier.place_of_supply && (
                    <div className="text-sm text-gray-600">{supplier.place_of_supply}</div>
                  )}
                </div>
              ))}
              {inputValue.trim() && suggestions.length > 0 && (
                <div className="p-2 border-t border-gray-200 bg-gray-50">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNoMatchFound}
                    className="w-full text-blue-600"
                  >
                    Create new supplier "{inputValue.trim()}"
                  </Button>
                </div>
              )}
            </>
          ) : inputValue.length >= 2 ? (
            <div className="p-3 text-center">
              <div className="text-gray-500 mb-2">No suppliers found</div>
              <Button
                size="sm"
                onClick={handleNoMatchFound}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create "{inputValue.trim()}"
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* New Supplier Modal */}
      <Dialog open={showNewSupplierModal} onOpenChange={setShowNewSupplierModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="supplier_name">Supplier Name *</Label>
              <Input
                id="supplier_name"
                value={newSupplierData.name}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Supplier name"
              />
            </div>

            <div>
              <Label htmlFor="supplier_gstin">GSTIN *</Label>
              <Input
                id="supplier_gstin"
                value={newSupplierData.gstin}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>

            <div>
              <Label htmlFor="supplier_place">Place of Supply *</Label>
              <Input
                id="supplier_place"
                value={newSupplierData.place_of_supply}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, place_of_supply: e.target.value }))}
                placeholder="e.g., Mumbai, Maharashtra"
              />
            </div>

            <div>
              <Label htmlFor="supplier_mobile">Mobile Number *</Label>
              <Input
                id="supplier_mobile"
                value={newSupplierData.contact}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, contact: e.target.value }))}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
            </div>

            <div>
              <Label htmlFor="supplier_state">State</Label>
              <Input
                id="supplier_state"
                value={newSupplierData.state}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, state: e.target.value }))}
                placeholder="State name"
              />
            </div>

            <div>
              <Label htmlFor="supplier_address">Address</Label>
              <Textarea
                id="supplier_address"
                value={newSupplierData.address}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full address"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowNewSupplierModal(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNewSupplier}
                className="bg-green-600 hover:bg-green-700"
              >
                Create Supplier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace Supplier Modal */}
      <Dialog open={showReplaceModal} onOpenChange={setShowReplaceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supplier Name Options</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              Did you mean one of these existing suppliers?
            </p>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {similarSuppliers.map((supplier) => (
                <div 
                  key={supplier.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSelectSupplier(supplier)}
                >
                  <div className="font-medium">{supplier.name}</div>
                  {supplier.gstin && (
                    <div className="text-sm text-gray-600">GSTIN: {supplier.gstin}</div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReplaceModal(false);
                  setNewSupplierData(prev => ({ ...prev, name: inputValue.trim() }));
                  setShowNewSupplierModal(true);
                }}
                className="w-full"
              >
                Create New Supplier "{inputValue.trim()}"
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SupplierAutocomplete;