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
  console.log('[SupplierAutocomplete] Component mounted/rendered');
  
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
    pan: '',
    city: '',
    pin_code: '',
    state_code: ''
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
    console.log('[SupplierAutocomplete] handleNoMatchFound called with inputValue:', inputValue);
    if (!inputValue.trim()) return;
    
    // Check if there are similar suppliers
    const similar = suggestions.filter(s => 
      s.similarity_score > 0.3 || 
      s.name.toLowerCase().includes(inputValue.toLowerCase())
    );
    
    console.log('[SupplierAutocomplete] Found similar suppliers:', similar.length);
    
    if (similar.length > 0) {
      setSimilarSuppliers(similar);
      setShowReplaceModal(true);
      console.log('[SupplierAutocomplete] Opening replace modal');
    } else {
      // No similar suppliers, offer to create new
      setNewSupplierData(prev => ({ ...prev, name: inputValue.trim() }));
      setShowNewSupplierModal(true);
      console.log('[SupplierAutocomplete] Opening new supplier modal with name:', inputValue.trim());
    }
  };

  // Auto-extract state_code from GSTIN
  const handleSupplierGstinChange = (value) => {
    setNewSupplierData({
      ...newSupplierData, 
      gstin: value,
      state_code: value.length >= 2 ? value.substring(0, 2) : newSupplierData.state_code
    });
  };

  // Handle new supplier creation
  const handleCreateNewSupplier = async () => {
    console.log('[SupplierAutocomplete] handleCreateNewSupplier called');
    console.log('[SupplierAutocomplete] Current supplier data:', JSON.stringify(newSupplierData, null, 2));
    
    try {
      // Validate required fields
      const missingFields = [];
      if (!newSupplierData.name?.trim()) missingFields.push('Name');
      if (!newSupplierData.gstin?.trim()) missingFields.push('GSTIN');
      if (!newSupplierData.place_of_supply?.trim()) missingFields.push('Place of Supply');
      if (!newSupplierData.contact?.trim()) missingFields.push('Mobile Number');
      
      if (missingFields.length > 0) {
        const errorMsg = `Please fill all required fields: ${missingFields.join(', ')}`;
        console.error('[SupplierAutocomplete] Validation failed. Missing fields:', missingFields);
        toast.error(errorMsg);
        return;
      }

      console.log('[SupplierAutocomplete] Validation passed. Sending API request...');
      console.log('[SupplierAutocomplete] Request URL:', `${API}/suppliers/quick-create`);
      console.log('[SupplierAutocomplete] Request payload:', JSON.stringify(newSupplierData, null, 2));
      
      const response = await axios.post(`${API}/suppliers/quick-create`, newSupplierData);
      console.log('[SupplierAutocomplete] API response received:', response.data);
      
      toast.success('New supplier created successfully!');
      
      console.log('[SupplierAutocomplete] Calling handleSelectSupplier with new supplier data');
      handleSelectSupplier(response.data);
      
      console.log('[SupplierAutocomplete] Closing modal');
      setShowNewSupplierModal(false);
      
      // Reset form
      console.log('[SupplierAutocomplete] Resetting form data');
      setNewSupplierData({
        name: '',
        gstin: '',
        place_of_supply: '',
        contact: '',
        state: '',
        address: '',
        pan: '',
        city: '',
        pin_code: '',
        state_code: ''
      });
      
      console.log('[SupplierAutocomplete] Supplier creation completed successfully');
      
    } catch (error) {
      console.error('[SupplierAutocomplete] Error creating supplier:', error);
      console.error('[SupplierAutocomplete] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Show detailed error message
      let errorMessage = 'Failed to create supplier';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
        console.error('[SupplierAutocomplete] Backend error message:', error.response.data.detail);
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid data format. Check console for details.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  // Handle replace existing supplier
  const handleReplaceSupplier = async (supplier) => {
    try {
      await axios.put(`${API}/suppliers/${supplier.id}/name`, {
        new_name: inputValue.trim()
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

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('[SupplierAutocomplete] Modal state changed - showNewSupplierModal:', showNewSupplierModal);
    if (showNewSupplierModal) {
      console.log('[SupplierAutocomplete] Modal is now OPEN. Current form data:', newSupplierData);
    }
  }, [showNewSupplierModal, newSupplierData]);

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
      <Dialog open={showNewSupplierModal} onOpenChange={(open) => {
        console.log('[SupplierAutocomplete] Modal state changing to:', open);
        setShowNewSupplierModal(open);
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">* indicates required field</p>
          </DialogHeader>
          
          {/* Test Button - Remove after debugging */}
          <div className="bg-yellow-50 border border-yellow-300 p-2 rounded text-xs">
            <strong>Debug Test:</strong>
            <button 
              onClick={() => alert('Button clicks work!')} 
              className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-xs"
            >
              Test Click
            </button>
            {showNewSupplierModal && <span className="ml-2 text-green-600">✓ Modal is open</span>}
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="supplier_name" className="text-red-600">Supplier Name *</Label>
              <Input
                id="supplier_name"
                value={newSupplierData.name}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter supplier name"
                className={!newSupplierData.name?.trim() ? 'border-red-300' : ''}
              />
            </div>

            <div>
              <Label htmlFor="supplier_gstin" className="text-red-600">GSTIN *</Label>
              <Input
                id="supplier_gstin"
                value={newSupplierData.gstin}
                onChange={(e) => handleSupplierGstinChange(e.target.value.toUpperCase())}
                placeholder="27AAAAA0000A1Z5 (auto-extracts state code)"
                maxLength={15}
                className={!newSupplierData.gstin?.trim() ? 'border-red-300' : ''}
              />
              {newSupplierData.state_code && (
                <p className="text-xs text-green-600 mt-1">✓ State Code: {newSupplierData.state_code}</p>
              )}
            </div>

            <div>
              <Label htmlFor="supplier_place" className="text-red-600">Place of Supply *</Label>
              <Input
                id="supplier_place"
                value={newSupplierData.place_of_supply}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, place_of_supply: e.target.value }))}
                placeholder="e.g., Mumbai, Maharashtra"
                className={!newSupplierData.place_of_supply?.trim() ? 'border-red-300' : ''}
              />
            </div>

            <div>
              <Label htmlFor="supplier_mobile" className="text-red-600">Mobile Number *</Label>
              <Input
                id="supplier_mobile"
                value={newSupplierData.contact}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setNewSupplierData(prev => ({ ...prev, contact: value }));
                }}
                placeholder="10-digit mobile number"
                maxLength={10}
                className={!newSupplierData.contact?.trim() ? 'border-red-300' : ''}
              />
              <p className="text-xs text-gray-500 mt-1">Numbers only, no spaces or special characters</p>
            </div>

            {/* NEW: Structured Address Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="supplier_city">City</Label>
                <Input
                  id="supplier_city"
                  value={newSupplierData.city}
                  onChange={(e) => setNewSupplierData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City name"
                />
              </div>

              <div>
                <Label htmlFor="supplier_pin">PIN Code</Label>
                <Input
                  id="supplier_pin"
                  value={newSupplierData.pin_code}
                  onChange={(e) => setNewSupplierData(prev => ({ ...prev, pin_code: e.target.value.replace(/\D/g, '') }))}
                  placeholder="6-digit PIN"
                  maxLength={6}
                />
              </div>

              <div>
                <Label htmlFor="supplier_state_code">State Code</Label>
                <Input
                  id="supplier_state_code"
                  value={newSupplierData.state_code}
                  onChange={(e) => setNewSupplierData(prev => ({ ...prev, state_code: e.target.value.replace(/\D/g, '') }))}
                  placeholder="2-digit"
                  maxLength={2}
                  readOnly={!!newSupplierData.gstin}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="supplier_state">State (Optional)</Label>
              <Input
                id="supplier_state"
                value={newSupplierData.state}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, state: e.target.value }))}
                placeholder="State name"
              />
            </div>

            <div>
              <Label htmlFor="supplier_address">Address (Optional)</Label>
              <Textarea
                id="supplier_address"
                value={newSupplierData.address}
                onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full address"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                type="button"
                variant="outline" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[SupplierAutocomplete] Cancel button clicked');
                  setShowNewSupplierModal(false);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[SupplierAutocomplete] Create Supplier button clicked');
                  handleCreateNewSupplier();
                }}
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
                <div key={supplier.id} className="p-3 border rounded-lg">
                  <div className="font-medium">{supplier.name}</div>
                  {supplier.gstin && (
                    <div className="text-sm text-gray-600">GSTIN: {supplier.gstin}</div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelectSupplier(supplier)}
                      className="flex-1"
                    >
                      Use This
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReplaceSupplier(supplier)}
                      className="flex-1 text-orange-600 border-orange-200"
                    >
                      Update to "{inputValue.trim()}"
                    </Button>
                  </div>
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