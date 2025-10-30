import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import TransporterAutocomplete from '../components/TransporterAutocomplete';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BROKERAGE_TYPES = [
  { value: 'per_quintal', label: 'Per Quintal' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' }
];

const PACK_SIZE_OPTIONS = [
  { value: 100, label: '100 kg' },
  { value: 50, label: '50 kg' },
  { value: 30, label: '30 kg' },
  { value: 25, label: '25 kg' }
];

function SalesInvoicePage({ user, onLogout }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  
  // Photo approval modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedPreEntry, setSelectedPreEntry] = useState(null);
  const [weighbridgeData, setWeighbridgeData] = useState(null);
  
  // Mixed Load modal state
  const [showMixedLoadModal, setShowMixedLoadModal] = useState(false);
  const [mixedLoadPreEntry, setMixedLoadPreEntry] = useState(null);
  const [mixedLoadAllocations, setMixedLoadAllocations] = useState([]);
  const [autoAllocating, setAutoAllocating] = useState(false);
  const [creatingInvoices, setCreatingInvoices] = useState(false);
  
  // Invoice form modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isReturn, setIsReturn] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null); // Store saved invoice with bill no
  const [companySettings, setCompanySettings] = useState(null); // For print template
  const [invoiceData, setInvoiceData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    weighbridge_slip_no: '',
    is_entry: false, // false = Godown (default), true = Entry
    
    // Item details
    item_id: '',
    item_name: '',
    marka: '',
    bharti: 50,
    bags: 0,
    kgs: 0,
    actual_qtl: 0,
    rate: '',
    amount: 0,
    
    // Taxes (CGST + SGST only, no IGST)
    cgst_rate: '',
    cgst_amount: 0,
    sgst_rate: '',
    sgst_amount: 0,
    
    // Additional charges
    freight: '',
    loading_charges: '',
    other_charges: '',
    
    // TCS (applied before GST)
    tcs_applicable: false,
    tcs_rate: '',
    tcs_amount: 0,
    
    // Rounding
    round_off: 0,
    subtotal: 0,
    tax_total: 0,
    grand_total: 0,
    
    // Broker (always shown)
    broker_name: '',
    brokerage_type: 'per_quintal',
    brokerage_rate: '',
    
    // Transportation details
    city_from: 'Sanawad',
    city_to: '',
    driver_name: '',
    driver_license_no: '',
    driver_license_expiry: '',
    vehicle_number: '', // Auto-filled from weighbridge
    freight_type: 'To Pay',
    freight_amount: '',
    freight_rate: '',
    advance_freight: '',
    net_freight: '',
    owner_name: '',
    bilty_no: '',
    transporter_name: '',
    transporter_id: '',
    gross_weight: 0, // Auto-filled from weighbridge
    tare_weight: 0,  // Auto-filled from weighbridge
    net_weight: 0,   // Auto-filled from weighbridge
    anugya_no: '',   // Government registration number
    
    remarks: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQueue();
    fetchCompanySettings(); // Fetch for print template
  }, [statusFilter]);

  const fetchCompanySettings = async () => {
    try {
      const response = await axios.get(`${API}/company-settings`);
      setCompanySettings(response.data);
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await axios.get(`${API}/sales/queue?${params}`);
      setQueue(response.data);
    } catch (error) {
      console.error('Error fetching sales queue:', error);
      toast.error('Failed to load sales queue');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPhotos = async (preEntry) => {
    try {
      // Fetch weighbridge entry for this pre-entry
      const response = await axios.get(`${API}/weighbridge-entry/by-slip/${preEntry.pre_entry_number}`);
      setWeighbridgeData(response.data);
      setSelectedPreEntry(preEntry);
      setShowPhotoModal(true);
    } catch (error) {
      console.error('Error fetching weighbridge data:', error);
      toast.error('Failed to load weighbridge data');
    }
  };

  const handlePrintInvoice = async (invoiceNumber) => {
    try {
      // Fetch full invoice details by invoice number
      const response = await axios.get(`${API}/sales/invoice/by-number/${invoiceNumber}`);
      setSavedInvoice(response.data);
      
      // Trigger print after a short delay to ensure state updates
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice for printing');
    }
  };

  const handleEditInvoice = async (invoiceNumber) => {
    try {
      // Fetch full invoice details by invoice number
      const response = await axios.get(`${API}/sales/invoice/by-number/${invoiceNumber}`);
      const invoice = response.data;
      
      // Set editing mode
      setEditingInvoice(invoice);
      
      // Pre-fill form with invoice data - using first line item for single-item invoices
      const firstLineItem = invoice.line_items?.[0] || {};
      setInvoiceData({
        invoice_date: invoice.invoice_date,
        weighbridge_slip_no: invoice.weighbridge_slip_no || '',
        is_entry: invoice.is_entry || false,
        
        // Item details from first line item
        item_id: firstLineItem.item_id || '',
        item_name: firstLineItem.item_name || '',
        marka: firstLineItem.marka || '',
        bharti: firstLineItem.bharti || 50,
        bags: firstLineItem.bags || 0,
        kgs: firstLineItem.kgs || 0,
        actual_qtl: firstLineItem.actual_qtl || 0,
        rate: firstLineItem.rate || '',
        amount: firstLineItem.amount || 0,
        
        // Taxes
        cgst_rate: invoice.cgst_rate || '',
        cgst_amount: invoice.cgst_amount || 0,
        sgst_rate: invoice.sgst_rate || '',
        sgst_amount: invoice.sgst_amount || 0,
        
        // Additional charges
        freight: invoice.freight || '',
        loading_charges: invoice.loading_charges || '',
        other_charges: invoice.other_charges || '',
        
        // TCS
        tcs_applicable: invoice.tcs_applicable || false,
        tcs_rate: invoice.tcs_rate || '',
        tcs_amount: invoice.tcs_amount || 0,
        
        // Totals
        round_off: invoice.round_off || 0,
        subtotal: firstLineItem.amount || 0,
        tax_total: (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0),
        grand_total: invoice.grand_total || 0,
        
        // Broker
        broker_name: invoice.broker_name || '',
        brokerage_type: invoice.brokerage_type || 'per_quintal',
        brokerage_rate: invoice.brokerage_rate || '',
        
        // Transportation
        city_from: invoice.city_from || 'Sanawad',
        city_to: invoice.city_to || '',
        driver_name: invoice.driver_name || '',
        driver_license_no: invoice.driver_license_no || '',
        driver_license_expiry: invoice.driver_license_expiry || '',
        vehicle_number: invoice.vehicle_number || '',
        freight_type: invoice.freight_type || 'To Pay',
        freight_amount: invoice.freight_amount || '',
        freight_rate: invoice.freight_rate || '',
        advance_freight: invoice.advance_freight || '',
        net_freight: invoice.net_freight || '',
        owner_name: invoice.owner_name || '',
        bilty_no: invoice.bilty_no || '',
        transporter_name: invoice.transporter_name || '',
        transporter_id: invoice.transporter_id || '',
        gross_weight: invoice.gross_weight || 0,
        tare_weight: invoice.tare_weight || 0,
        net_weight: invoice.net_weight || 0,
        anugya_no: invoice.anugya_no || '',
        
        remarks: invoice.remarks || ''
      });
      
      // Set the pre-entry to show customer info (non-editable)
      setSelectedPreEntry({
        customer_name: invoice.customer_name,
        customer_id: invoice.customer_id,
        pre_entry_number: invoice.pre_entry_number,
        pre_entry_id: invoice.pre_entry_id
      });
      
      // Set return status
      setIsReturn(invoice.sale_type === 'sales_return');
      
      // Open invoice form dialog
      setShowInvoiceModal(true);
      
      toast.info('Editing invoice - Customer and Date are locked', { duration: 3000 });
    } catch (error) {
      console.error('Error loading invoice for editing:', error);
      toast.error('Failed to load invoice for editing');
    }
  };


  const handleApprovePhotos = () => {
    setShowPhotoModal(false);
    
    // Check if this is a mixed load
    if (selectedPreEntry?.is_mixed_load) {
      handleMixedLoadProcess(selectedPreEntry);
    } else {
      handleCreateInvoice(selectedPreEntry);
    }
  };
  
  // Handle mixed load processing
  const handleMixedLoadProcess = async (preEntry) => {
    setMixedLoadPreEntry(preEntry);
    
    // Fetch full pre-entry details with line items
    try {
      const response = await axios.get(`${API}/sales/pre-entry/by-number/${preEntry.pre_entry_number}`);
      const fullPreEntry = response.data.pre_entry; // Access nested pre_entry
      
      // Check if line_items exists
      if (!fullPreEntry.line_items || fullPreEntry.line_items.length === 0) {
        toast.error('No line items found in this mixed load pre-entry');
        return;
      }
      
      // Initialize allocations from line items
      const initialAllocations = fullPreEntry.line_items.map(item => ({
        line_id: item.line_id,
        customer_name: item.customer_name,
        item_name: item.item_name,
        marka: item.marka,
        expected_weight: item.expected_weight,
        bharti: item.bharti || 50,
        actual_weight: 0,
        actual_bags: 0,
        actual_kgs: 0,
        actual_qtl: 0,
        item_rate: item.item_rate || 0,
        amount: 0
      }));
      
      setMixedLoadAllocations(initialAllocations);
      setShowMixedLoadModal(true);
    } catch (error) {
      console.error('Error fetching pre-entry details:', error);
      toast.error('Failed to load mixed load details');
    }
  };
  
  // Auto-allocate weights proportionally
  const handleAutoAllocate = () => {
    if (!mixedLoadPreEntry) return;
    
    const netWeight = mixedLoadPreEntry.net_weight || 0;
    const totalExpected = mixedLoadAllocations.reduce((sum, item) => sum + (item.expected_weight || 0), 0);
    
    if (totalExpected === 0) {
      toast.error('Cannot auto-allocate: total expected weight is zero');
      return;
    }
    
    // Track allocated weight as we go
    let allocatedSoFar = 0;
    
    const updatedAllocations = mixedLoadAllocations.map((item, index) => {
      const proportion = item.expected_weight / totalExpected;
      let actualWeight = 0;
      
      // For last item, allocate remaining to avoid rounding errors
      if (index === mixedLoadAllocations.length - 1) {
        actualWeight = netWeight - allocatedSoFar;
      } else {
        actualWeight = netWeight * proportion;
        allocatedSoFar += actualWeight;
      }
      
      const bharti = item.bharti || 50;
      const actual_bags = Math.floor(actualWeight / bharti);
      const actual_kgs = parseFloat((actualWeight % bharti).toFixed(2));
      const actual_qtl = parseFloat((actualWeight / 100).toFixed(2));
      const amount = parseFloat((actual_qtl * item.item_rate).toFixed(2));
      
      return {
        ...item,
        actual_weight: parseFloat(actualWeight.toFixed(2)),
        actual_bags,
        actual_kgs,
        actual_qtl,
        amount
      };
    });
    
    setMixedLoadAllocations(updatedAllocations);
    toast.success('Weights auto-allocated proportionally');
  };
  
  // Update manual allocation for a line item
  const handleAllocationChange = (index, field, value) => {
    const updatedAllocations = [...mixedLoadAllocations];
    updatedAllocations[index][field] = value;
    
    // Recalculate bags, kgs, qtl if weight changed
    if (field === 'actual_weight') {
      const actualWeight = parseFloat(value) || 0;
      const bharti = updatedAllocations[index].bharti || 50;
      updatedAllocations[index].actual_bags = Math.floor(actualWeight / bharti);
      updatedAllocations[index].actual_kgs = parseFloat((actualWeight % bharti).toFixed(2));
      updatedAllocations[index].actual_qtl = parseFloat((actualWeight / 100).toFixed(2));
      updatedAllocations[index].amount = parseFloat((updatedAllocations[index].actual_qtl * updatedAllocations[index].item_rate).toFixed(2));
    }
    
    setMixedLoadAllocations(updatedAllocations);
  };
  
  // Calculate weight variance
  const calculateWeightVariance = () => {
    if (!mixedLoadPreEntry) return 0;
    
    const netWeight = mixedLoadPreEntry.net_weight || 0;
    const totalAllocated = mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_weight || 0), 0);
    
    return Math.abs(netWeight - totalAllocated);
  };
  
  // Create all invoices
  const handleCreateAllInvoices = async () => {
    if (!mixedLoadPreEntry) return;
    
    const variance = calculateWeightVariance();
    if (variance > 100) {
      toast.error(`Weight variance (${variance.toFixed(2)} kg) exceeds ±100 kg limit`);
      return;
    }
    
    // Validate all allocations have weights
    const hasZeroAllocations = mixedLoadAllocations.some(item => !item.actual_weight || item.actual_weight === 0);
    if (hasZeroAllocations) {
      toast.error('All line items must have allocated weights');
      return;
    }
    
    setCreatingInvoices(true);
    
    try {
      const payload = {
        pre_entry_id: mixedLoadPreEntry.pre_entry_id,
        invoice_date: new Date().toISOString().split('T')[0],
        weighbridge_slip_no: mixedLoadPreEntry.pre_entry_number,
        is_entry: mixedLoadPreEntry.is_entry || false,
        line_items: mixedLoadAllocations.map(item => ({
          line_id: item.line_id,
          actual_weight: item.actual_weight,
          actual_bags: item.actual_bags,
          actual_kgs: item.actual_kgs,
          actual_qtl: item.actual_qtl
        })),
        broker_name: mixedLoadPreEntry.broker_name,
        brokerage_type: mixedLoadPreEntry.brokerage_type || 'per_quintal',
        brokerage_rate: mixedLoadPreEntry.brokerage_rate || 0,
        freight: 0,
        remarks: ''
      };
      
      const response = await axios.post(`${API}/sales/mixed-load-invoice/bulk?created_by=${user?.username || 'admin'}`, payload);
      
      toast.success(`Successfully created ${response.data.total_invoices_created} invoices!`);
      
      // Close modal and refresh queue
      setShowMixedLoadModal(false);
      fetchQueue();
      
      // Show summary
      console.log('Invoice Creation Summary:', response.data);
      
    } catch (error) {
      console.error('Error creating invoices:', error);
      toast.error(error.response?.data?.detail || 'Failed to create invoices');
    } finally {
      setCreatingInvoices(false);
    }
  };

  const handleCreateInvoice = (preEntry) => {
    setSelectedPreEntry(preEntry);
    setSavedInvoice(null); // Reset saved invoice state
    
    // Calculate bags and kgs from net_weight
    const netWeight = preEntry.net_weight || 0;
    const bharti = preEntry.bharti || 50; // Pack size from pre-entry
    const bags = Math.floor(netWeight / bharti);
    const kgs = netWeight % bharti;
    const actualQtl = (netWeight / 100).toFixed(2);
    
    // Pre-fill invoice data from pre-entry
    setInvoiceData({
      ...invoiceData,
      invoice_date: new Date().toISOString().split('T')[0],
      weighbridge_slip_no: preEntry.pre_entry_number || '',
      is_entry: preEntry.is_entry || false, // Carry from pre-entry
      item_id: preEntry.item_id,
      item_name: preEntry.item_name,
      marka: preEntry.marka || '',
      bharti: bharti, // From pre-entry (NOT auto-calculated)
      bags: bags,
      kgs: kgs,
      actual_qtl: actualQtl,
      rate: preEntry.rate || '', // Rate from pre-entry
      broker_name: preEntry.broker_name || '',
      brokerage_type: preEntry.brokerage_type || 'per_quintal',
      brokerage_rate: preEntry.brokerage_rate || '',
      // Auto-fill transportation from weighbridge
      vehicle_number: preEntry.vehicle_number || '',
      gross_weight: preEntry.gross_weight || 0,
      tare_weight: preEntry.tare_weight || 0,
      net_weight: preEntry.net_weight || 0
    });
    
    setShowInvoiceModal(true);
  };

  const calculateTotals = () => {
    const bags = parseFloat(invoiceData.bags) || 0;
    const kgs = parseFloat(invoiceData.kgs) || 0;
    const bharti = parseFloat(invoiceData.bharti) || 50;
    const rate = parseFloat(invoiceData.rate) || 0;
    
    // Calculate actual quintals
    const actualQtl = ((bags * bharti) + kgs) / 100;
    
    // Calculate amount
    const amount = actualQtl * rate;
    
    // Subtotal = Amount (before TCS and GST)
    const subtotal = amount;
    
    // Calculate TCS on Subtotal (BEFORE GST)
    const tcsAmount = invoiceData.tcs_applicable && invoiceData.tcs_rate 
      ? (subtotal * parseFloat(invoiceData.tcs_rate)) / 100 
      : 0;
    
    // Calculate taxes on (Subtotal + TCS)
    const taxableAmount = subtotal + tcsAmount;
    const cgstAmount = invoiceData.cgst_rate ? (taxableAmount * parseFloat(invoiceData.cgst_rate)) / 100 : 0;
    const sgstAmount = invoiceData.sgst_rate ? (taxableAmount * parseFloat(invoiceData.sgst_rate)) / 100 : 0;
    const taxTotal = cgstAmount + sgstAmount;
    
    // Calculate additional charges
    const freight = parseFloat(invoiceData.freight) || 0;
    const loadingCharges = parseFloat(invoiceData.loading_charges) || 0;
    const otherCharges = parseFloat(invoiceData.other_charges) || 0;
    
    // Calculate grand total before rounding
    // Formula: Subtotal + TCS + GST + Additional Charges
    const beforeRounding = subtotal + tcsAmount + taxTotal + freight + loadingCharges + otherCharges;
    
    // Apply rounding to nearest rupee
    const roundOff = Math.round(beforeRounding) - beforeRounding;
    const grandTotal = Math.round(beforeRounding);
    
    // If Sales Return, make amounts negative
    const multiplier = isReturn ? -1 : 1;
    
    return {
      actual_qtl: actualQtl.toFixed(2),
      amount: (amount * multiplier).toFixed(2),
      cgst_amount: (cgstAmount * multiplier).toFixed(2),
      sgst_amount: (sgstAmount * multiplier).toFixed(2),
      tax_total: (taxTotal * multiplier).toFixed(2),
      tcs_amount: (tcsAmount * multiplier).toFixed(2),
      round_off: (roundOff * multiplier).toFixed(2),
      subtotal: (subtotal * multiplier).toFixed(2),
      grand_total: (grandTotal * multiplier).toFixed(2)
    };
  };

  // Auto-calculate when relevant fields change
  useEffect(() => {
    if (showInvoiceModal) {
      const calculated = calculateTotals();
      setInvoiceData(prev => ({
        ...prev,
        ...calculated
      }));
    }
  }, [
    invoiceData.bags,
    invoiceData.kgs,
    invoiceData.bharti,
    invoiceData.rate,
    invoiceData.cgst_rate,
    invoiceData.sgst_rate,
    invoiceData.freight,
    invoiceData.loading_charges,
    invoiceData.other_charges,
    invoiceData.tcs_applicable,
    invoiceData.tcs_rate,
    isReturn
  ]);

  const handleSubmitInvoice = async () => {
    try {
      setSubmitting(true);
      
      // Validation
      if (!invoiceData.rate) {
        toast.error('Rate per quintal is required');
        return;
      }
      
      const payload = {
        pre_entry_id: selectedPreEntry.pre_entry_id,  // Fixed: use pre_entry_id from queue
        sale_type: isReturn ? 'sales_return' : 'normal_sale',
        invoice_date: invoiceData.invoice_date,
        weighbridge_slip_no: invoiceData.weighbridge_slip_no,
        is_entry: invoiceData.is_entry,
        
        line_items: [{
          item_id: invoiceData.item_id,  // Now available from queue
          item_name: invoiceData.item_name,
          marka: invoiceData.marka,
          bags: parseInt(invoiceData.bags),
          kgs: parseFloat(invoiceData.kgs),
          bharti: parseInt(invoiceData.bharti),
          actual_qtl: parseFloat(invoiceData.actual_qtl),
          rate: parseFloat(invoiceData.rate),
          amount: parseFloat(invoiceData.amount)
        }],
        
        cgst_rate: invoiceData.cgst_rate ? parseFloat(invoiceData.cgst_rate) : null,
        cgst_amount: parseFloat(invoiceData.cgst_amount),
        sgst_rate: invoiceData.sgst_rate ? parseFloat(invoiceData.sgst_rate) : null,
        sgst_amount: parseFloat(invoiceData.sgst_amount),
        
        freight: invoiceData.freight ? parseFloat(invoiceData.freight) : null,
        loading_charges: invoiceData.loading_charges ? parseFloat(invoiceData.loading_charges) : null,
        other_charges: invoiceData.other_charges ? parseFloat(invoiceData.other_charges) : null,
        
        tcs_applicable: invoiceData.tcs_applicable,
        tcs_rate: invoiceData.tcs_rate ? parseFloat(invoiceData.tcs_rate) : null,
        tcs_amount: parseFloat(invoiceData.tcs_amount),
        
        round_off: parseFloat(invoiceData.round_off),
        grand_total: parseFloat(invoiceData.grand_total),
        
        broker_name: invoiceData.broker_name || null,
        brokerage_type: invoiceData.brokerage_type !== 'none' ? invoiceData.brokerage_type : null,
        brokerage_rate: invoiceData.brokerage_rate ? parseFloat(invoiceData.brokerage_rate) : null,
        
        // Transportation details
        city_from: invoiceData.city_from || null,
        city_to: invoiceData.city_to || null,
        driver_name: invoiceData.driver_name || null,
        driver_license_no: invoiceData.driver_license_no || null,
        driver_license_expiry: invoiceData.driver_license_expiry || null,
        freight_type: invoiceData.freight_type || null,
        freight_amount: invoiceData.freight_amount ? parseFloat(invoiceData.freight_amount) : null,
        freight_rate: invoiceData.freight_rate ? parseFloat(invoiceData.freight_rate) : null,
        advance_freight: invoiceData.advance_freight ? parseFloat(invoiceData.advance_freight) : null,
        net_freight: invoiceData.net_freight ? parseFloat(invoiceData.net_freight) : null,
        owner_name: invoiceData.owner_name || null,
        bilty_no: invoiceData.bilty_no || null,
        transporter_name: invoiceData.transporter_name || null,
        transporter_id: invoiceData.transporter_id || null,
        anugya_no: invoiceData.anugya_no || null,
        
        remarks: invoiceData.remarks || null,
        created_by: user.username
      };
      
      console.log('[FRONTEND] Submitting invoice payload:', JSON.stringify(payload, null, 2));
      
      let response;
      
      // Check if we're in edit mode
      if (editingInvoice) {
        // UPDATE existing invoice with PUT request
        console.log(`[FRONTEND] Updating invoice ${editingInvoice.invoice_number}`);
        response = await axios.put(`${API}/sales/invoice/${editingInvoice.invoice_number}`, payload);
        toast.success(`Invoice ${editingInvoice.invoice_number} updated successfully`);
      } else {
        // CREATE new invoice with POST request
        console.log('[FRONTEND] Creating new invoice');
        response = await axios.post(`${API}/sales/invoice`, payload);
        toast.success(`${isReturn ? 'Sales Return' : 'Sales Invoice'} saved: ${response.data.invoice_number}`);
      }
      
      // Store complete invoice data for print
      setSavedInvoice(response.data);
      
      // Don't close modal yet - show the bill number and print buttons
      // setShowInvoiceModal(false);
      fetchQueue();
      
    } catch (error) {
      console.error('Error saving invoice:', error);
      console.error('Error response:', error.response?.data);
      const action = editingInvoice ? 'update' : 'create';
      toast.error(error.response?.data?.detail || `Failed to ${action} invoice`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceData({
      invoice_date: new Date().toISOString().split('T')[0],
      weighbridge_slip_no: '',
      is_entry: false,
      item_id: '',
      item_name: '',
      marka: '',
      bharti: 50,
      bags: 0,
      kgs: 0,
      actual_qtl: 0,
      rate: '',
      amount: 0,
      cgst_rate: '',
      cgst_amount: 0,
      sgst_rate: '',
      sgst_amount: 0,
      freight: '',
      loading_charges: '',
      other_charges: '',
      tcs_applicable: false,
      tcs_rate: '',
      tcs_amount: 0,
      round_off: 0,
      subtotal: 0,
      tax_total: 0,
      grand_total: 0,
      broker_name: '',
      brokerage_type: 'per_quintal',
      brokerage_rate: '',
      remarks: ''
    });
    setIsReturn(false);
    setEditingInvoice(null); // Reset editing state
  };

  const handleCloseInvoiceModal = (open) => {
    setShowInvoiceModal(open);
    if (!open) {
      // Reset editing state when modal is closed
      setEditingInvoice(null);
      setSavedInvoice(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      invoice_generated: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Sales Invoice</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Process sales invoices and returns</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-semibold">Search</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by pre-entry number or customer..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="status-pending" value="pending">Pending</SelectItem>
                  <SelectItem key="status-invoice-generated" value="invoice_generated">Invoice Generated</SelectItem>
                  <SelectItem key="status-all" value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchQueue} className="btn-primary">
                🔄 Refresh Queue
              </Button>
            </div>
          </div>
        </Card>

        {/* Queue Table */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4" style={{color: '#3E2723'}}>Sales Queue</h2>
          
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No sales pre-entries found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 w-[13%]">Pre-Entry No.</th>
                    <th className="text-left p-3 w-[10%]">Date</th>
                    <th className="text-left p-3 w-[17%]">Customer</th>
                    <th className="text-left p-3 w-[13%]">Item</th>
                    <th className="text-left p-3 w-[12%]">Marka</th>
                    <th className="text-center p-3 w-[10%]">Net Wt (Qtls)</th>
                    <th className="text-left p-3 w-[14%]">Broker</th>
                    <th className="text-center p-3 w-[11%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">
                        {item.pre_entry_number}
                        {item.is_mixed_load && (
                          <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-300">
                            📦 Mixed Load
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        {item.is_mixed_load ? (
                          <span className="text-purple-700 font-semibold">Multiple Customers</span>
                        ) : (
                          item.customer_name
                        )}
                      </td>
                      <td className="p-3">
                        {item.is_mixed_load ? (
                          <span className="text-purple-700 font-semibold">Multiple Items</span>
                        ) : (
                          item.item_name
                        )}
                      </td>
                      <td className="p-3">{item.marka || '-'}</td>
                      <td className="p-3 text-center">{item.net_weight ? (item.net_weight / 100).toFixed(2) : '-'}</td>
                      <td className="p-3">{item.broker_name || '-'}</td>
                      <td className="p-3">{getStatusBadge(item.status)}</td>
                      <td className="p-3 text-center">
                        {item.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleViewPhotos(item)}
                            className={item.is_mixed_load ? "bg-purple-600 hover:bg-purple-700" : "btn-primary"}
                          >
                            {item.is_mixed_load ? '📦 Split Load' : '⚙️ Process'}
                          </Button>
                        )}
                        {item.status === 'invoice_generated' && item.invoice_number && (
                          <div className="flex gap-2 justify-center">
                            {isAdmin && (
                              <Button
                                size="sm"
                                onClick={() => handleEditInvoice(item.invoice_number)}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                ✏️ Edit
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handlePrintInvoice(item.invoice_number)}
                              className="btn-secondary"
                            >
                              🖨️ Print
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Photo Approval Modal */}
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Photo Approval - {selectedPreEntry?.pre_entry_number}</DialogTitle>
              <DialogDescription>
                Review and approve weighbridge photos before creating invoice
              </DialogDescription>
            </DialogHeader>
            
            {weighbridgeData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold mb-2">TARE Photo (Empty Truck)</h3>
                    {weighbridgeData.photo_tare_url ? (
                      <img src={weighbridgeData.photo_tare_url} alt="Tare" className="w-full rounded border" />
                    ) : (
                      <div className="bg-gray-100 p-8 text-center rounded">No photo available</div>
                    )}
                    <p className="text-sm mt-2">Weight: {weighbridgeData.tare_weight} kg</p>
                  </div>
                  
                  <div>
                    <h3 className="font-bold mb-2">GROSS Photo (Loaded Truck)</h3>
                    {weighbridgeData.photo_gross_url ? (
                      <img src={weighbridgeData.photo_gross_url} alt="Gross" className="w-full rounded border" />
                    ) : (
                      <div className="bg-gray-100 p-8 text-center rounded">No photo available</div>
                    )}
                    <p className="text-sm mt-2">Weight: {weighbridgeData.gross_weight} kg</p>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded">
                  <h3 className="font-bold mb-2">Net Weight</h3>
                  <p className="text-2xl font-bold text-green-600">{weighbridgeData.net_weight} kg</p>
                  <p className="text-sm text-gray-600">({(weighbridgeData.net_weight / 100).toFixed(2)} quintals)</p>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPhotoModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleApprovePhotos} className="btn-primary">
                    ✅ Approve & Continue to Invoice
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Invoice Form Modal - Will be implemented in next phase */}
        <Dialog open={showInvoiceModal} onOpenChange={handleCloseInvoiceModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print-hide-invoice-modal">
            <DialogHeader>
              <DialogTitle>
                {savedInvoice ? (
                  <div className="flex items-center gap-3">
                    <span>{isReturn ? '🔄 Sales Return' : '📄 Sales Invoice'}</span>
                    <Badge className="bg-green-600 text-white text-lg px-3 py-1">
                      {savedInvoice.invoice_number}
                    </Badge>
                    <Badge className="bg-blue-600 text-white">POSTED</Badge>
                  </div>
                ) : editingInvoice ? (
                  <div className="flex items-center gap-3">
                    <span>✏️ Edit Invoice</span>
                    <Badge className="bg-blue-600 text-white text-lg px-3 py-1">
                      {editingInvoice.invoice_number}
                    </Badge>
                  </div>
                ) : (
                  <span>{isReturn ? '🔄 Sales Return' : '📄 Sales Invoice'} - {selectedPreEntry?.pre_entry_number}</span>
                )}
              </DialogTitle>
              <DialogDescription>
                {savedInvoice ? 'Invoice has been saved. You can edit, print, or close this window.' : editingInvoice ? 'Update invoice details. Customer and Date are locked.' : 'Fill in the invoice details and save'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Return Toggle */}
              <div className="flex items-center space-x-2 bg-blue-50 p-4 rounded">
                <Checkbox
                  id="isReturn"
                  checked={isReturn}
                  onCheckedChange={setIsReturn}
                />
                <Label htmlFor="isReturn" className="font-medium cursor-pointer">
                  This is a Sales Return (negative amounts)
                </Label>
              </div>

              {/* Pre-Entry Details */}
              <Card className={`p-4 ${editingInvoice ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">Pre-Entry Details</h3>
                  {editingInvoice && (
                    <Badge className="bg-yellow-600 text-white">🔒 Locked Fields</Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Customer {editingInvoice && '🔒'}</p>
                    <p className="font-medium">{selectedPreEntry?.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Item</p>
                    <p className="font-medium">{selectedPreEntry?.item_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Net Weight</p>
                    <p className="font-medium">{selectedPreEntry?.net_weight} kg</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Place of Supply</p>
                    <p className="font-medium">{selectedPreEntry?.place_of_supply}</p>
                  </div>
                </div>
              </Card>

              {/* Invoice Header */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Invoice Date * {editingInvoice && '🔒'}</Label>
                  <Input
                    type="date"
                    value={invoiceData.invoice_date}
                    onChange={(e) => setInvoiceData({...invoiceData, invoice_date: e.target.value})}
                    className={`mt-1 ${editingInvoice ? 'bg-yellow-100 cursor-not-allowed' : ''}`}
                    disabled={editingInvoice}
                  />
                </div>
                <div>
                  <Label>Weighbridge Slip No.</Label>
                  <Input
                    value={invoiceData.weighbridge_slip_no}
                    className="mt-1 bg-gray-100"
                    disabled
                  />
                </div>
                <div>
                  <Label>Location Type</Label>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="godown"
                        checked={!invoiceData.is_entry}
                        onChange={() => setInvoiceData({...invoiceData, is_entry: false})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="godown" className="cursor-pointer">Godown</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="entry"
                        checked={invoiceData.is_entry}
                        onChange={() => setInvoiceData({...invoiceData, is_entry: true})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="entry" className="cursor-pointer">Entry</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Item & Quantity Details */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Item & Quantity</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>Marka</Label>
                    <Input
                      value={invoiceData.marka}
                      onChange={(e) => setInvoiceData({...invoiceData, marka: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Pack Size (Bharti)</Label>
                    <Select 
                      value={invoiceData.bharti.toString()} 
                      onValueChange={(val) => setInvoiceData({...invoiceData, bharti: parseInt(val)})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PACK_SIZE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bags</Label>
                    <Input
                      type="number"
                      value={invoiceData.bags}
                      onChange={(e) => setInvoiceData({...invoiceData, bags: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Remaining Kgs</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.kgs}
                      onChange={(e) => setInvoiceData({...invoiceData, kgs: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Actual Quintals</p>
                    <p className="text-xl font-bold">{invoiceData.actual_qtl}</p>
                  </div>
                  <div>
                    <Label>Rate per Quintal (₹) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.rate}
                      onChange={(e) => setInvoiceData({...invoiceData, rate: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="text-xl font-bold">₹ {invoiceData.amount}</p>
                  </div>
                </div>
              </Card>

              {/* Taxes (CGST + SGST only) */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Taxes (CGST + SGST)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CGST Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.cgst_rate}
                      onChange={(e) => setInvoiceData({...invoiceData, cgst_rate: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-600 mt-1">Amount: ₹ {invoiceData.cgst_amount}</p>
                  </div>
                  <div>
                    <Label>SGST Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.sgst_rate}
                      onChange={(e) => setInvoiceData({...invoiceData, sgst_rate: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-600 mt-1">Amount: ₹ {invoiceData.sgst_amount}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ Tax is calculated on (Subtotal + TCS)
                </p>
              </Card>

              {/* Additional Charges */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Additional Charges</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Freight (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.freight}
                      onChange={(e) => setInvoiceData({...invoiceData, freight: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Loading Charges (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.loading_charges}
                      onChange={(e) => setInvoiceData({...invoiceData, loading_charges: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Other Charges (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.other_charges}
                      onChange={(e) => setInvoiceData({...invoiceData, other_charges: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>

              {/* TCS */}
              <Card className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Checkbox
                    id="tcs"
                    checked={invoiceData.tcs_applicable}
                    onCheckedChange={(checked) => setInvoiceData({...invoiceData, tcs_applicable: checked})}
                  />
                  <Label htmlFor="tcs" className="font-bold cursor-pointer">TCS Applicable</Label>
                </div>
                
                {invoiceData.tcs_applicable && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>TCS Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.tcs_rate}
                        onChange={(e) => setInvoiceData({...invoiceData, tcs_rate: e.target.value})}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-sm text-gray-600">TCS Amount</p>
                      <p className="text-xl font-bold">₹ {invoiceData.tcs_amount}</p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Broker Details (always shown) */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">Broker Details (Optional)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Broker Name</Label>
                    <Input
                      value={invoiceData.broker_name}
                      onChange={(e) => setInvoiceData({...invoiceData, broker_name: e.target.value})}
                      placeholder="Enter broker name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Brokerage Type</Label>
                    <Select 
                      value={invoiceData.brokerage_type} 
                      onValueChange={(val) => setInvoiceData({...invoiceData, brokerage_type: val})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BROKERAGE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Brokerage Rate</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.brokerage_rate}
                      onChange={(e) => setInvoiceData({...invoiceData, brokerage_rate: e.target.value})}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>

              {/* Transportation Details */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-bold mb-3 text-blue-900">🚚 Transportation Details</h3>
                
                {/* Route Information */}
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Route Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>City From</Label>
                      <Input
                        value={invoiceData.city_from}
                        onChange={(e) => setInvoiceData({...invoiceData, city_from: e.target.value})}
                        placeholder="Origin city"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>City To</Label>
                      <Input
                        value={invoiceData.city_to}
                        onChange={(e) => setInvoiceData({...invoiceData, city_to: e.target.value})}
                        placeholder="Destination city"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Transporter & Vehicle */}
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Transporter & Vehicle</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Transporter Name</Label>
                      <TransporterAutocomplete
                        value={invoiceData.transporter_name}
                        onSelect={(transporter) => setInvoiceData({
                          ...invoiceData, 
                          transporter_name: transporter.name,
                          transporter_id: transporter.id
                        })}
                        placeholder="Type transporter name..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Vehicle Number (Auto-filled)</Label>
                      <Input
                        value={invoiceData.vehicle_number}
                        onChange={(e) => setInvoiceData({...invoiceData, vehicle_number: e.target.value})}
                        placeholder="MH12AB1234"
                        className="mt-1 bg-gray-100"
                        readOnly
                      />
                    </div>
                    <div>
                      <Label>Owner Name</Label>
                      <Input
                        value={invoiceData.owner_name}
                        onChange={(e) => setInvoiceData({...invoiceData, owner_name: e.target.value})}
                        placeholder="Vehicle owner"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Driver Details */}
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Driver Details</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Driver Name</Label>
                      <Input
                        value={invoiceData.driver_name}
                        onChange={(e) => setInvoiceData({...invoiceData, driver_name: e.target.value})}
                        placeholder="Driver name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>License Number</Label>
                      <Input
                        value={invoiceData.driver_license_no}
                        onChange={(e) => setInvoiceData({...invoiceData, driver_license_no: e.target.value})}
                        placeholder="License no."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>License Expiry Date</Label>
                      <Input
                        type="date"
                        value={invoiceData.driver_license_expiry}
                        onChange={(e) => setInvoiceData({...invoiceData, driver_license_expiry: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Freight Details */}
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Freight Details</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>Freight Type</Label>
                      <Select 
                        value={invoiceData.freight_type} 
                        onValueChange={(val) => setInvoiceData({...invoiceData, freight_type: val})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem key="to-pay" value="To Pay">To Pay</SelectItem>
                          <SelectItem key="paid" value="Paid">Paid</SelectItem>
                          <SelectItem key="tbb" value="TBB">TBB (To Be Billed)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Freight Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.freight_rate}
                        onChange={(e) => setInvoiceData({...invoiceData, freight_rate: e.target.value})}
                        placeholder="Per qtl/vehicle"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Freight Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.freight_amount}
                        onChange={(e) => setInvoiceData({...invoiceData, freight_amount: e.target.value})}
                        placeholder="Total amount"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Advance Freight</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.advance_freight}
                        onChange={(e) => {
                          const advance = parseFloat(e.target.value) || 0;
                          const total = parseFloat(invoiceData.freight_amount) || 0;
                          setInvoiceData({
                            ...invoiceData, 
                            advance_freight: e.target.value,
                            net_freight: (total - advance).toString()
                          });
                        }}
                        placeholder="Advance paid"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    <div>
                      <Label>Net Freight</Label>
                      <Input
                        type="number"
                        value={invoiceData.net_freight}
                        className="mt-1 bg-gray-100"
                        readOnly
                      />
                    </div>
                    <div>
                      <Label>Bilty No.</Label>
                      <Input
                        value={invoiceData.bilty_no}
                        onChange={(e) => setInvoiceData({...invoiceData, bilty_no: e.target.value})}
                        placeholder="Lorry receipt no."
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Weight Information (Auto-filled from Weighbridge) */}
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Weight Information (From Weighbridge)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Gross Weight (kg)</Label>
                      <Input
                        type="number"
                        value={invoiceData.gross_weight}
                        className="mt-1 bg-gray-100"
                        readOnly
                      />
                    </div>
                    <div>
                      <Label>Tare Weight (kg)</Label>
                      <Input
                        type="number"
                        value={invoiceData.tare_weight}
                        className="mt-1 bg-gray-100"
                        readOnly
                      />
                    </div>
                    <div>
                      <Label>Net Weight (kg)</Label>
                      <Input
                        type="number"
                        value={invoiceData.net_weight}
                        className="mt-1 bg-gray-100"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Government Registration */}
                <div>
                  <Label>Anugya No. (Government Registration)</Label>
                  <Input
                    value={invoiceData.anugya_no}
                    onChange={(e) => setInvoiceData({...invoiceData, anugya_no: e.target.value})}
                    placeholder="Enter after state portal registration"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    ℹ️ This number is obtained after registering the sale and paying tax on the state government portal
                  </p>
                </div>
              </Card>

              {/* Remarks */}
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={invoiceData.remarks}
                  onChange={(e) => setInvoiceData({...invoiceData, remarks: e.target.value})}
                  placeholder="Any additional notes..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Totals Summary */}
              <Card className="p-4 bg-gray-50">
                <h3 className="font-bold mb-3">Invoice Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal (including taxes & charges):</span>
                    <span className="font-medium">₹ {invoiceData.subtotal}</span>
                  </div>
                  {invoiceData.tcs_applicable && (
                    <div className="flex justify-between">
                      <span>TCS Amount:</span>
                      <span className="font-medium">₹ {invoiceData.tcs_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Round Off:</span>
                    <span className="font-medium">₹ {invoiceData.round_off}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2">
                    <span>Grand Total:</span>
                    <span className="text-green-600">₹ {invoiceData.grand_total}</span>
                  </div>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-between gap-2">
                <div className="flex gap-2">
                  {savedInvoice && (
                    <>
                      <Button 
                        onClick={() => {
                          // Switch from saved view back to edit mode
                          handleEditInvoice(savedInvoice.invoice_number);
                          setSavedInvoice(null); // Clear saved state to show form
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        ✏️ Edit Invoice
                      </Button>
                      <Button 
                        onClick={() => handlePrintInvoice(savedInvoice.invoice_number)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        🖨️ Print Invoice
                      </Button>
                      <Button 
                        onClick={() => toast.info('Freight slip print feature coming soon')}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        🖨️ Print Freight Slip
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowInvoiceModal(false);
                      setSavedInvoice(null);
                      resetInvoiceForm();
                    }}
                  >
                    {savedInvoice ? 'Close' : 'Cancel'}
                  </Button>
                  {!savedInvoice && (
                    <Button 
                      onClick={handleSubmitInvoice} 
                      className="btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? '💾 Saving...' : editingInvoice ? `✏️ Update Invoice` : `💾 Save ${isReturn ? 'Return' : 'Invoice'}`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Mixed Load Split Modal */}
        <Dialog open={showMixedLoadModal} onOpenChange={setShowMixedLoadModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                📦 Mixed Load Invoice Split - {mixedLoadPreEntry?.pre_entry_number}
              </DialogTitle>
              <DialogDescription>
                Allocate weights to each customer-item combination and create separate invoices
              </DialogDescription>
            </DialogHeader>
            
            {/* Summary Section */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm text-gray-600">Total Net Weight</label>
                <div className="text-2xl font-bold text-blue-600">
                  {mixedLoadPreEntry?.net_weight?.toFixed(2) || 0} kg
                </div>
                <div className="text-sm text-gray-500">
                  {mixedLoadPreEntry?.net_weight ? (mixedLoadPreEntry.net_weight / 100).toFixed(2) : 0} qtl
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Total Allocated</label>
                <div className="text-2xl font-bold text-green-600">
                  {mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_weight || 0), 0).toFixed(2)} kg
                </div>
                <div className="text-sm text-gray-500">
                  {(mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_weight || 0), 0) / 100).toFixed(2)} qtl
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Weight Variance</label>
                <div className={`text-2xl font-bold ${calculateWeightVariance() <= 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateWeightVariance().toFixed(2)} kg
                </div>
                <div className={`text-sm ${calculateWeightVariance() <= 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateWeightVariance() <= 100 ? '✓ Within ±100 kg limit' : '✗ Exceeds ±100 kg limit'}
                </div>
              </div>
            </div>
            
            {/* Auto-Allocate Button */}
            <div className="flex justify-end mb-4">
              <Button
                onClick={handleAutoAllocate}
                variant="outline"
                className="btn-secondary"
                disabled={autoAllocating}
              >
                🔄 Auto-Allocate (Proportional)
              </Button>
            </div>
            
            {/* Line Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Customer</th>
                    <th className="text-left p-3 text-sm font-medium">Item</th>
                    <th className="text-left p-3 text-sm font-medium">Marka</th>
                    <th className="text-right p-3 text-sm font-medium">Expected (kg)</th>
                    <th className="text-right p-3 text-sm font-medium">Allocated (kg)</th>
                    <th className="text-right p-3 text-sm font-medium">Bags</th>
                    <th className="text-right p-3 text-sm font-medium">Kgs</th>
                    <th className="text-right p-3 text-sm font-medium">Qtl</th>
                    <th className="text-right p-3 text-sm font-medium">Rate/Qtl</th>
                    <th className="text-right p-3 text-sm font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {mixedLoadAllocations.map((item, index) => (
                    <tr key={item.line_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">{item.customer_name}</td>
                      <td className="p-3 text-sm">{item.item_name}</td>
                      <td className="p-3 text-sm">{item.marka || '-'}</td>
                      <td className="p-3 text-right text-sm text-gray-500">
                        {item.expected_weight?.toFixed(2) || 0}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={item.actual_weight || ''}
                          onChange={(e) => handleAllocationChange(index, 'actual_weight', parseFloat(e.target.value) || 0)}
                          className="text-right"
                          step="0.01"
                          min="0"
                        />
                      </td>
                      <td className="p-3 text-right text-sm font-medium">{item.actual_bags}</td>
                      <td className="p-3 text-right text-sm font-medium">{item.actual_kgs?.toFixed(2)}</td>
                      <td className="p-3 text-right text-sm font-medium">{item.actual_qtl?.toFixed(2)}</td>
                      <td className="p-3 text-right text-sm">₹{item.item_rate?.toFixed(2)}</td>
                      <td className="p-3 text-right text-sm font-bold text-green-600">
                        ₹{item.amount?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan="4" className="p-3 text-right">Total:</td>
                    <td className="p-3 text-right">
                      {mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_weight || 0), 0).toFixed(2)} kg
                    </td>
                    <td className="p-3 text-right">
                      {mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_bags || 0), 0)}
                    </td>
                    <td className="p-3 text-right">
                      {mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_kgs || 0), 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      {mixedLoadAllocations.reduce((sum, item) => sum + (item.actual_qtl || 0), 0).toFixed(2)}
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right text-green-600">
                      ₹{mixedLoadAllocations.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {/* Broker Commission Summary */}
            {mixedLoadPreEntry?.broker_name && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Broker Commission Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Broker:</span>
                    <div className="font-medium">{mixedLoadPreEntry.broker_name}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <div className="font-medium capitalize">{mixedLoadPreEntry.brokerage_type?.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Rate:</span>
                    <div className="font-medium">
                      {mixedLoadPreEntry.brokerage_type === 'percentage' ? 
                        `${mixedLoadPreEntry.brokerage_rate}%` : 
                        `₹${mixedLoadPreEntry.brokerage_rate}`
                      }
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  ℹ️ Commission will be distributed proportionally across {mixedLoadAllocations.length} invoices
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowMixedLoadModal(false)}
                variant="outline"
                disabled={creatingInvoices}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAllInvoices}
                className="btn-primary bg-purple-600 hover:bg-purple-700"
                disabled={creatingInvoices || calculateWeightVariance() > 100}
              >
                {creatingInvoices ? (
                  <>⏳ Creating Invoices...</>
                ) : (
                  <>✅ Create All Invoices ({mixedLoadAllocations.length})</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>


      {/* Print Template (Hidden on Screen) - Sales Invoice */}
      {savedInvoice && companySettings && (
        <div className="print-invoice-container" style={{display: 'none'}}>
          <style>{`
            @media print {
              @page { 
                size: A4; 
                margin: 8mm; 
              }
              
              /* Hide ALL page elements except print template */
              body * {
                visibility: hidden !important;
              }
              
              /* Make print template and its children visible */
              .print-invoice-container,
              .print-invoice-container * {
                visibility: visible !important;
              }
              
              /* Position print template at top of page */
              .print-invoice-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-height: 100vh !important;
                overflow: hidden !important;
                display: block !important;
                background: white !important;
                padding: 8mm !important;
                page-break-after: avoid !important;
              }
              
              /* Ensure table displays correctly */
              .print-invoice-container table { 
                display: table !important; 
                width: 100% !important;
                page-break-inside: avoid !important;
              }
              .print-invoice-container thead { display: table-header-group !important; }
              .print-invoice-container tbody { display: table-row-group !important; }
              .print-invoice-container tr { display: table-row !important; }
              .print-invoice-container td, 
              .print-invoice-container th { 
                display: table-cell !important; 
              }
              
              /* Prevent page breaks */
              .no-break { 
                page-break-inside: avoid !important; 
              }
              
              /* Prevent extra pages */
              @media print {
                html, body {
                  height: 100vh !important;
                  overflow: hidden !important;
                }
              }
            }
          `}</style>

          {/* Helper function for sentence case */}
          {(() => {
            const toSentenceCase = (text) => {
              if (!text || typeof text !== 'string') return text || 'N/A';
              return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            };

            return (
          <div style={{fontFamily: 'Arial, sans-serif', padding: '5px', pageBreakInside: 'avoid', maxHeight: '100vh', overflow: 'hidden'}}>
            {/* Header */}
            <div style={{textAlign: 'center', marginBottom: '8px'}}>
              {companySettings.company_logo_url && (
                <img src={companySettings.company_logo_url} alt="Logo" style={{height: '58px', margin: '0 auto 5px'}} />
              )}
              <h1 style={{fontSize: '24px', fontWeight: 'bold', margin: '5px 0'}}>{companySettings.company_name}</h1>
              <p style={{fontSize: '12px', margin: '2px 0'}}>Ward No.18, Omkareshwar Road, Sanawad, PIN -451111</p>
              <p style={{fontSize: '12px', margin: '2px 0'}}>Mobile: {companySettings.mobile} | GSTIN: {companySettings.gstin}</p>
              <p style={{fontSize: '10px', fontWeight: '600', margin: '5px 0'}}>SUBJECT TO SANAWAD JURISDICTION</p>
              <h2 style={{fontSize: '22px', fontWeight: 'bold', margin: '8px 0 5px 0'}}>INVOICE</h2>
            </div>

            {/* Invoice Body - Bordered Container */}
            <div style={{border: '2px solid black', padding: '10px'}}>
              {/* Invoice Details */}
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', fontSize: '12px', marginBottom: '8px', border: '1px solid black', borderLeft: 'none', borderRight: 'none', padding: '5px', margin: '0 -10px 8px -10px', paddingLeft: '15px', paddingRight: '15px'}}>
                <div><span style={{fontWeight: 'bold'}}>Invoice No:</span> {savedInvoice.invoice_number}</div>
                <div><span style={{fontWeight: 'bold'}}>Date:</span> {savedInvoice.invoice_date}</div>
                <div><span style={{fontWeight: 'bold'}}>Time:</span> {savedInvoice.invoice_time || 'N/A'}</div>
                <div><span style={{fontWeight: 'bold'}}>Anugya No:</span> {savedInvoice.anugya_no || 'N/A'}</div>
              </div>

              {/* Bill To & Broker */}
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '8px', fontSize: '12px'}}>
                <div style={{padding: '5px'}}>
                  <p style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '3px'}}>Bill To:</p>
                  <p style={{fontWeight: 'bold', margin: '2px 0'}}>{toSentenceCase(savedInvoice.customer_name)}</p>
                  <p style={{margin: '2px 0'}}>{toSentenceCase(savedInvoice.customer_address)}</p>
                  <p style={{margin: '2px 0'}}>City: {toSentenceCase(savedInvoice.customer_city)} | State: {toSentenceCase(savedInvoice.customer_state)}</p>
                  <p style={{margin: '2px 0'}}>GSTIN: {savedInvoice.customer_gstin || 'N/A'}</p>
                  <p style={{margin: '2px 0'}}>Contact: {savedInvoice.customer_contact || 'N/A'}</p>
                </div>
                <div style={{padding: '5px'}}>
                  <p style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '3px'}}>Broker:</p>
                  <p style={{fontWeight: 'bold', margin: '2px 0'}}>{toSentenceCase(savedInvoice.broker_name)}</p>
                  <p style={{margin: '2px 0'}}>{toSentenceCase(savedInvoice.broker_address)}</p>
                  <p style={{margin: '2px 0'}}>City: {toSentenceCase(savedInvoice.broker_city)} | State: {toSentenceCase(savedInvoice.broker_state)}</p>
                  <p style={{margin: '2px 0'}}>GSTIN: {savedInvoice.broker_gstin || 'N/A'}</p>
                  <p style={{margin: '2px 0'}}>Mobile: {savedInvoice.broker_mobile || 'N/A'}</p>
                </div>
              </div>

            {/* Items Table - Fixed Height */}
            <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '8px', tableLayout: 'fixed'}}>
              <thead>
                <tr style={{backgroundColor: '#e5e7eb'}}>
                  <th style={{borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '6%'}}>PO No</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '7%'}}>PO Date</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '20%'}}>Item/HSN/Marka</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '7%'}}>No Bag</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '7%'}}>No Kgs</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '7%'}}>Pkg Size</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '9%'}}>Quantity (Qtl)</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '10%'}}>Rate</th>
                  <th style={{borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px', width: '12%'}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Actual line items */}
                {savedInvoice.line_items?.map((item, idx) => (
                  <tr key={idx} style={{height: '28px'}}>
                    <td style={{borderLeft: '1px solid black', borderRight: '1px solid black', padding: '3px'}}>{item.po_number || '-'}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>{item.po_date || '-'}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>
                      {toSentenceCase(item.item_name)}<br/>
                      {item.hsn_code && <span style={{fontSize: '10px'}}>HSN: {item.hsn_code}</span>}<br/>
                      {item.marka && <span style={{fontSize: '10px'}}>Marka: {toSentenceCase(item.marka)}</span>}
                    </td>
                    <td style={{borderRight: '1px solid black', padding: '3px', textAlign: 'right'}}>{item.bags}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px', textAlign: 'right'}}>{item.kgs}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px', textAlign: 'right'}}>{item.bharti}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px', textAlign: 'right', fontWeight: 'bold'}}>{item.actual_qtl}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px', textAlign: 'right'}}>₹{item.rate}</td>
                    <td style={{borderRight: '1px solid black', padding: '3px', textAlign: 'right', fontWeight: 'bold'}}>₹{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
                
                {/* Empty rows to maintain fixed height - always show at least 5 rows total */}
                {Array.from({ length: Math.max(0, 5 - (savedInvoice.line_items?.length || 0)) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} style={{height: '28px'}}>
                    <td style={{borderLeft: '1px solid black', borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                    <td style={{borderRight: '1px solid black', padding: '3px'}}>&nbsp;</td>
                  </tr>
                ))}
                
                {/* Bottom border row */}
                <tr style={{height: '0px'}}>
                  <td colSpan="9" style={{borderTop: '1px solid black', padding: '0'}}></td>
                </tr>
              </tbody>
            </table>

            {/* Transportation Details */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', fontSize: '11px', marginBottom: '8px'}}>
              <div style={{padding: '3px'}}>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>From:</span> {toSentenceCase(savedInvoice.city_from)}</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>To:</span> {toSentenceCase(savedInvoice.city_to)}</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Vehicle No:</span> {savedInvoice.vehicle_number || 'N/A'}</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Driver:</span> {toSentenceCase(savedInvoice.driver_name)}</p>
              </div>
              <div style={{padding: '3px'}}>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Tare:</span> {savedInvoice.tare_weight || 'N/A'} kg</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Gross:</span> {savedInvoice.gross_weight || 'N/A'} kg</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Net:</span> {savedInvoice.net_weight || 'N/A'} kg</p>
              </div>
              <div style={{padding: '3px'}}>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Transporter:</span> {toSentenceCase(savedInvoice.transporter_name)}</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Bilty No:</span> {savedInvoice.bilty_no || 'N/A'}</p>
                <p style={{margin: '2px 0'}}><span style={{fontWeight: 'bold'}}>Freight:</span> ₹{savedInvoice.freight_amount || '0.00'}</p>
              </div>
            </div>

            {/* Totals */}
            <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '8px'}}>
              <div style={{width: '33%', fontSize: '12px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0'}}><span>Subtotal:</span><span>₹{savedInvoice.subtotal?.toFixed(2)}</span></div>
                {savedInvoice.cgst > 0 && <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0'}}><span>CGST:</span><span>₹{savedInvoice.cgst?.toFixed(2)}</span></div>}
                {savedInvoice.sgst > 0 && <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0'}}><span>SGST:</span><span>₹{savedInvoice.sgst?.toFixed(2)}</span></div>}
                {savedInvoice.igst > 0 && <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0'}}><span>IGST:</span><span>₹{savedInvoice.igst?.toFixed(2)}</span></div>}
                {savedInvoice.tcs_amount > 0 && <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0'}}><span>TCS:</span><span>₹{savedInvoice.tcs_amount?.toFixed(2)}</span></div>}
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: '1px solid black', fontWeight: 'bold'}}><span>Grand Total:</span><span>₹{savedInvoice.grand_total?.toFixed(2)}</span></div>
              </div>
            </div>

            {/* Bank Details */}
            <div style={{padding: '5px', fontSize: '11px', marginBottom: '8px'}}>
              <p style={{fontWeight: 'bold', marginBottom: '3px'}}>Bank Details:</p>
              <p style={{margin: '2px 0'}}>PUNJAB NATIONAL BANK A/C NO. 2892008700001656</p>
              <p style={{margin: '2px 0'}}>IFSC CODE - PUNB0289200 BRANCH - INDORE (M.P.)</p>
            </div>

            {/* Warranty & FSSAI */}
            <div style={{fontSize: '10px', marginBottom: '8px', padding: '5px'}}>
              <p style={{fontWeight: 'bold', margin: '2px 0'}}>Warranty:</p>
              <p style={{margin: '2px 0', lineHeight: '1.4'}}>
                I/We hereby certify that Foods/Food mention in this Invoice is/are wanted tot be of the nature and quality which it/these purport/purports to be, certified that particulars given above are true and correct
              </p>
              <p style={{margin: '5px 0 2px', fontWeight: 'bold'}}>FSSAI NO :- 11414890000275</p>
            </div>

            {/* Signature */}
            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
              <div style={{textAlign: 'center', fontSize: '12px'}}>
                <div style={{height: '32px'}}></div>
                <div style={{borderTop: '1px solid black', paddingTop: '3px'}}>Authorized Signatory</div>
              </div>
            </div>
            </div>
            {/* End of Invoice Body Border */}

          </div>
            );
          })()}
        </div>
      )}

    </Layout>
  );
}

export default SalesInvoicePage;
