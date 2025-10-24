import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL || '';

function CompanySettingsPage({ user, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsExist, setSettingsExist] = useState(false);
  
  // Company details
  const [companyName, setCompanyName] = useState('');
  const [companyGstin, setCompanyGstin] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyPin, setCompanyPin] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  
  // Statutory details
  const [ifssaiNo, setIfssaiNo] = useState('');
  
  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branch, setBranch] = useState('');
  
  // Legal
  const [warrantyText, setWarrantyText] = useState('I/We hereby certify that Foods/Food mentioned in this Invoice is/are warranted to be of the nature and quality which it/these purport/purports to be, certified that particulars given above are true and correct');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/company-settings`);
      const settings = response.data;
      
      // Populate form
      setCompanyName(settings.company_name);
      setCompanyGstin(settings.company_gstin);
      setCompanyAddress(settings.company_address);
      setCompanyCity(settings.company_city);
      setCompanyState(settings.company_state);
      setCompanyPin(settings.company_pin);
      setCompanyPhone(settings.company_phone);
      setCompanyEmail(settings.company_email || '');
      setIfssaiNo(settings.ifssai_no);
      setBankName(settings.bank_details.bank_name);
      setAccountNumber(settings.bank_details.account_number);
      setIfscCode(settings.bank_details.ifsc_code);
      setBranch(settings.bank_details.branch);
      setWarrantyText(settings.warranty_text);
      setSettingsExist(true);
    } catch (error) {
      if (error.response?.status === 404) {
        // Settings don't exist yet
        setSettingsExist(false);
      } else {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load company settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        company_name: companyName,
        company_gstin: companyGstin,
        company_address: companyAddress,
        company_city: companyCity,
        company_state: companyState,
        company_pin: companyPin,
        company_phone: companyPhone,
        company_email: companyEmail || null,
        ifssai_no: ifssaiNo,
        bank_details: {
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          branch: branch
        },
        warranty_text: warrantyText,
        created_by: user?.username || 'admin'
      };

      await axios.post(`${API}/api/company-settings`, payload);
      toast.success(settingsExist ? 'Company settings updated successfully' : 'Company settings created successfully');
      setSettingsExist(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error.response?.data?.detail || 'Failed to save company settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading company settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">⚙️ Company Settings</h1>
          <p className="text-gray-600 mt-2">Configure your company information, bank details, and statutory information</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Company Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Basic company details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="M/S Sudarshan Trading Company"
                    required
                  />
                </div>
                <div>
                  <Label>GSTIN *</Label>
                  <Input
                    value={companyGstin}
                    onChange={(e) => setCompanyGstin(e.target.value)}
                    placeholder="23ABPPC9083P1Z0"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Address *</Label>
                <Input
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Ward No.18, Omkareshwar Road"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>City *</Label>
                  <Input
                    value={companyCity}
                    onChange={(e) => setCompanyCity(e.target.value)}
                    placeholder="Sanawad"
                    required
                  />
                </div>
                <div>
                  <Label>State *</Label>
                  <Input
                    value={companyState}
                    onChange={(e) => setCompanyState(e.target.value)}
                    placeholder="Madhya Pradesh"
                    required
                  />
                </div>
                <div>
                  <Label>PIN Code *</Label>
                  <Input
                    value={companyPin}
                    onChange={(e) => setCompanyPin(e.target.value)}
                    placeholder="451111"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone *</Label>
                  <Input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="9753275524"
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="contact@sudarshan.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statutory Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Statutory Information</CardTitle>
              <CardDescription>Food safety and compliance details</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label>IFSSAI No. *</Label>
                <Input
                  value={ifssaiNo}
                  onChange={(e) => setIfssaiNo(e.target.value)}
                  placeholder="11414890000275"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Food Safety and Standards Authority of India registration number</p>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>Banking information for invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bank Name *</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="PUNJAB NATIONAL BANK"
                    required
                  />
                </div>
                <div>
                  <Label>Branch *</Label>
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="INDORE (M.P.)"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Account Number *</Label>
                  <Input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="2892008700001656"
                    required
                  />
                </div>
                <div>
                  <Label>IFSC Code *</Label>
                  <Input
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="PUNB0289200"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legal/Compliance Card */}
          <Card>
            <CardHeader>
              <CardTitle>Legal & Compliance</CardTitle>
              <CardDescription>Warranty and declaration text for invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Warranty/Declaration Text *</Label>
                <Textarea
                  value={warrantyText}
                  onChange={(e) => setWarrantyText(e.target.value)}
                  rows={4}
                  placeholder="Enter warranty declaration text..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">This text will appear on all invoices</p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="btn-primary px-8">
              {saving ? '⏳ Saving...' : settingsExist ? '💾 Update Settings' : '✅ Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default CompanySettingsPage;
