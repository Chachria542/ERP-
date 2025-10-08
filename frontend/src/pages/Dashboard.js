import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Dashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [marginCalls, setMarginCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, marginRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/custody/margin-calls`)
      ]);
      
      setStats(statsRes.data);
      setMarginCalls(marginRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
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

  const statCards = [
    {
      title: 'Total Custody Lots',
      value: stats?.total_custody_lots || 0,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: '#6B8E23',
      bgColor: 'rgba(107, 142, 35, 0.1)'
    },
    {
      title: 'Active Pledges',
      value: stats?.active_pledges || 0,
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      color: '#DAA520',
      bgColor: 'rgba(218, 165, 32, 0.1)'
    },
    {
      title: 'Margin Calls',
      value: stats?.margin_calls || 0,
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: stats?.margin_calls > 0 ? '#D32F2F' : '#6B8E23',
      bgColor: stats?.margin_calls > 0 ? 'rgba(211, 47, 47, 0.1)' : 'rgba(107, 142, 35, 0.1)'
    },
    {
      title: 'Total Inventory Value',
      value: `₹${(stats?.total_inventory_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#8B4513',
      bgColor: 'rgba(139, 69, 19, 0.1)'
    }
  ];

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Dashboard</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Welcome back, {user.name}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <Card 
              key={index}
              data-testid={`stat-card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="erp-card"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-2" style={{color: '#6B5846'}}>
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold" style={{color: stat.color}}>
                    {stat.value}
                  </p>
                </div>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{background: stat.bgColor}}
                >
                  <svg 
                    className="w-6 h-6" 
                    style={{color: stat.color}}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Margin Call Alerts */}
        {marginCalls.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="w-6 h-6" style={{color: '#D32F2F'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-2xl font-bold" style={{color: '#3E2723'}}>Margin Call Alerts</h2>
            </div>
            
            <div className="space-y-4">
              {marginCalls.map((alert, index) => (
                <Card 
                  key={index}
                  data-testid={`margin-call-${index}`}
                  className="erp-card border-l-4"
                  style={{
                    borderLeftColor: alert.alert_level === 'critical' ? '#D32F2F' : '#F57C00'
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-bold" style={{color: '#3E2723'}}>
                          {alert.lot_number}
                        </h3>
                        <span 
                          className={`badge ${
                            alert.alert_level === 'critical' ? 'badge-danger' : 'badge-warning'
                          }`}
                        >
                          {alert.alert_level.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm" style={{color: '#6B5846'}}>Party</p>
                          <p className="font-semibold" style={{color: '#3E2723'}}>{alert.party_name}</p>
                        </div>
                        <div>
                          <p className="text-sm" style={{color: '#6B5846'}}>Item</p>
                          <p className="font-semibold" style={{color: '#3E2723'}}>{alert.item_name}</p>
                        </div>
                        <div>
                          <p className="text-sm" style={{color: '#6B5846'}}>Current LTV</p>
                          <p className="font-semibold" style={{color: '#D32F2F'}}>
                            {alert.current_ltv.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.05)'}}>
                        <p className="text-sm font-semibold mb-2" style={{color: '#6B8E23'}}>
                          AI Recommendation:
                        </p>
                        <p className="text-sm" style={{color: '#3E2723'}}>
                          {alert.ai_recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4" style={{color: '#3E2723'}}>Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => window.location.href = '/weighbridge'}
              className="erp-card text-left hover:shadow-elevated transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                     style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                  <svg className="w-6 h-6" style={{color: '#6B8E23'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold" style={{color: '#3E2723'}}>New Weighbridge Entry</p>
                  <p className="text-sm" style={{color: '#6B5846'}}>Create pre-entry slip</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => window.location.href = '/custody'}
              className="erp-card text-left hover:shadow-elevated transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                     style={{background: 'rgba(218, 165, 32, 0.1)'}}>
                  <svg className="w-6 h-6" style={{color: '#DAA520'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold" style={{color: '#3E2723'}}>Create Custody Lot</p>
                  <p className="text-sm" style={{color: '#6B5846'}}>From weighbridge slip</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => window.location.href = '/master-data'}
              className="erp-card text-left hover:shadow-elevated transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                     style={{background: 'rgba(139, 69, 19, 0.1)'}}>
                  <svg className="w-6 h-6" style={{color: '#8B4513'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold" style={{color: '#3E2723'}}>Manage Master Data</p>
                  <p className="text-sm" style={{color: '#6B5846'}}>Parties, items, prices</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;