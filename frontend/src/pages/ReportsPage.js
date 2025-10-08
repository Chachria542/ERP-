import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ReportsPage({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [custodyLots, setCustodyLots] = useState([]);
  const [weighbridgeSlips, setWeighbridgeSlips] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, lotsRes, slipsRes, purchasesRes, salesRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/custody/lots`),
        axios.get(`${API}/weighbridge/slips`),
        axios.get(`${API}/purchases`),
        axios.get(`${API}/sales`)
      ]);
      
      setStats(statsRes.data);
      setCustodyLots(lotsRes.data);
      setWeighbridgeSlips(slipsRes.data);
      setPurchases(purchasesRes.data);
      setSales(salesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
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

  const totalPurchaseValue = purchases.reduce((sum, p) => sum + p.total_amount, 0);
  const totalSalesValue = sales.reduce((sum, s) => sum + s.grand_total, 0);
  const activePledgeValue = custodyLots.filter(l => l.pledged).reduce((sum, l) => sum + l.pledge_amount, 0);
  const totalWeighbridgeWeight = weighbridgeSlips
    .filter(s => s.net_weight)
    .reduce((sum, s) => sum + s.net_weight, 0);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Reports & Analytics</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Business insights and reconciliation</p>
        </div>

        {/* Financial Summary */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4" style={{color: '#3E2723'}}>Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="erp-card" data-testid="report-total-purchases">
              <p className="text-sm mb-2" style={{color: '#6B5846'}}>Total Purchases</p>
              <p className="text-3xl font-bold" style={{color: '#D32F2F'}}>
                ₹{totalPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm mt-1" style={{color: '#6B5846'}}>{purchases.length} transactions</p>
            </Card>

            <Card className="erp-card" data-testid="report-total-sales">
              <p className="text-sm mb-2" style={{color: '#6B5846'}}>Total Sales</p>
              <p className="text-3xl font-bold" style={{color: '#6B8E23'}}>
                ₹{totalSalesValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm mt-1" style={{color: '#6B5846'}}>{sales.length} invoices</p>
            </Card>

            <Card className="erp-card" data-testid="report-active-pledges">
              <p className="text-sm mb-2" style={{color: '#6B5846'}}>Active Pledge Value</p>
              <p className="text-3xl font-bold" style={{color: '#DAA520'}}>
                ₹{activePledgeValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm mt-1" style={{color: '#6B5846'}}>
                {custodyLots.filter(l => l.pledged).length} pledged lots
              </p>
            </Card>

            <Card className="erp-card" data-testid="report-profit-margin">
              <p className="text-sm mb-2" style={{color: '#6B5846'}}>Gross Margin</p>
              <p className="text-3xl font-bold" style={{
                color: totalSalesValue > totalPurchaseValue ? '#6B8E23' : '#D32F2F'
              }}>
                ₹{(totalSalesValue - totalPurchaseValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm mt-1" style={{color: '#6B5846'}}>
                {totalPurchaseValue > 0 
                  ? ((totalSalesValue - totalPurchaseValue) / totalPurchaseValue * 100).toFixed(2)
                  : 0}% margin
              </p>
            </Card>
          </div>
        </div>

        {/* Weighbridge Reconciliation */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4" style={{color: '#3E2723'}}>Weighbridge Reconciliation</h2>
          <Card className="erp-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm mb-2" style={{color: '#6B5846'}}>Total Slips</p>
                <p className="text-2xl font-bold" style={{color: '#3E2723'}}>{weighbridgeSlips.length}</p>
              </div>
              <div>
                <p className="text-sm mb-2" style={{color: '#6B5846'}}>Total Weight Processed</p>
                <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                  {totalWeighbridgeWeight.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg
                </p>
              </div>
              <div>
                <p className="text-sm mb-2" style={{color: '#6B5846'}}>Completed Slips</p>
                <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                  {weighbridgeSlips.filter(s => s.status === 'completed').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Custody Report */}
        <div>
          <h2 className="text-2xl font-bold mb-4" style={{color: '#3E2723'}}>Custody Ledger</h2>
          <Card className="erp-card">
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Lot Number</th>
                    <th>Party</th>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Value</th>
                    <th>Pledged</th>
                    <th>LTV</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {custodyLots.map(lot => (
                    <tr key={lot.id}>
                      <td className="font-semibold" style={{color: '#6B8E23'}}>{lot.lot_number}</td>
                      <td>{lot.party_name}</td>
                      <td>{lot.item_name}</td>
                      <td>{lot.quantity} kg</td>
                      <td>₹{lot.total_value.toLocaleString('en-IN')}</td>
                      <td className="font-bold">
                        {lot.pledged ? `₹${lot.pledge_amount.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="font-bold" style={{
                        color: lot.current_ltv >= 80 ? '#D32F2F' : lot.current_ltv >= 75 ? '#F57C00' : '#6B8E23'
                      }}>
                        {lot.pledged ? `${lot.current_ltv.toFixed(2)}%` : '-'}
                      </td>
                      <td>
                        <span className={`badge ${
                          lot.status === 'active' ? 'badge-success' :
                          lot.status === 'margin_call' ? 'badge-danger' :
                          'badge-info'
                        }`}>
                          {lot.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default ReportsPage;