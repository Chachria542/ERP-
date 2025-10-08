import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ProductionPage({ user, onLogout }) {
  const [batches, setBatches] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [rawItemId, setRawItemId] = useState('');
  const [rawQuantity, setRawQuantity] = useState('');
  const [processedItemId, setProcessedItemId] = useState('');
  const [processedQuantity, setProcessedQuantity] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [batchesRes, itemsRes] = await Promise.all([
        axios.get(`${API}/production/batches`),
        axios.get(`${API}/items`)
      ]);
      
      setBatches(batchesRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/production/batch`, {
        raw_item_id: rawItemId,
        raw_quantity: parseFloat(rawQuantity),
        processed_item_id: processedItemId
      });
      
      toast.success('Production batch started!');
      setShowCreateDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create batch');
    }
  };

  const handleCompleteBatch = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API}/production/complete`, {
        batch_id: selectedBatch.id,
        processed_quantity: parseFloat(processedQuantity)
      });
      
      toast.success('Production batch completed!');
      setShowCompleteDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to complete batch');
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>Production</h1>
            <p className="text-lg" style={{color: '#6B5846'}}>Raw to Processed Tracking</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-batch-button">
                Start New Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Start Production Batch</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div>
                  <Label>Raw Material</Label>
                  <select value={rawItemId} onChange={(e) => setRawItemId(e.target.value)} className="erp-select" required>
                    <option value="">Select Raw Item</option>
                    {items.map(i => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                </div>
                <div>
                  <Label>Raw Quantity (kg)</Label>
                  <Input type="number" step="0.01" value={rawQuantity} onChange={(e) => setRawQuantity(e.target.value)} required />
                </div>
                <div>
                  <Label>Processed Item</Label>
                  <select value={processedItemId} onChange={(e) => setProcessedItemId(e.target.value)} className="erp-select" required>
                    <option value="">Select Processed Item</option>
                    {items.map(i => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                </div>
                <Button type="submit" className="w-full btn-primary">Start Batch</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map(batch => (
            <Card key={batch.id} className="erp-card" data-testid={`batch-${batch.batch_number}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1" style={{color: '#3E2723'}}>{batch.batch_number}</h3>
                  <span className={`badge ${batch.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {batch.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-sm" style={{color: '#6B5846'}}>Raw Material</p>
                  <p className="font-semibold" style={{color: '#3E2723'}}>{batch.raw_item_name}</p>
                  <p className="text-sm">{batch.raw_quantity} kg</p>
                </div>
                <div>
                  <p className="text-sm" style={{color: '#6B5846'}}>Processed Item</p>
                  <p className="font-semibold" style={{color: '#3E2723'}}>{batch.processed_item_name}</p>
                  <p className="text-sm">{batch.processed_quantity} kg</p>
                </div>
                {batch.status === 'completed' && (
                  <div className="p-3 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <p className="text-sm" style={{color: '#6B5846'}}>Yield Percentage</p>
                    <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                      {batch.yield_percentage.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>

              {batch.status === 'in_progress' && (
                <Button 
                  onClick={() => {
                    setSelectedBatch(batch);
                    setShowCompleteDialog(true);
                  }}
                  className="w-full btn-primary"
                >
                  Complete Batch
                </Button>
              )}
            </Card>
          ))}
        </div>

        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Production Batch</DialogTitle>
            </DialogHeader>
            {selectedBatch && (
              <form onSubmit={handleCompleteBatch} className="space-y-4">
                <div className="p-4 rounded-lg" style={{background: '#F5E6D3'}}>
                  <p className="text-sm" style={{color: '#6B5846'}}>Batch Number</p>
                  <p className="font-bold text-lg mb-2" style={{color: '#3E2723'}}>{selectedBatch.batch_number}</p>
                  <p className="text-sm" style={{color: '#6B5846'}}>Raw Input</p>
                  <p className="font-semibold">{selectedBatch.raw_item_name} - {selectedBatch.raw_quantity} kg</p>
                </div>

                <div>
                  <Label>Processed Quantity (kg)</Label>
                  <Input type="number" step="0.01" value={processedQuantity} onChange={(e) => setProcessedQuantity(e.target.value)} required />
                </div>

                {processedQuantity && (
                  <div className="p-4 rounded-lg" style={{background: 'rgba(107, 142, 35, 0.1)'}}>
                    <p className="text-sm" style={{color: '#6B5846'}}>Expected Yield %</p>
                    <p className="text-2xl font-bold" style={{color: '#6B8E23'}}>
                      {((parseFloat(processedQuantity) / selectedBatch.raw_quantity) * 100).toFixed(2)}%
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full btn-primary">Complete Batch</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default ProductionPage;