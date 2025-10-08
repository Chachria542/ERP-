import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('operator');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password
      });
      
      toast.success('Login successful!');
      onLogin(response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/auth/register`, {
        username,
        password,
        name,
        role
      });
      
      toast.success('Registration successful! Please login.');
      setIsRegister(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{background: 'linear-gradient(135deg, #FDF6E3 0%, #F5E6D3 100%)'}}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
               style={{background: 'linear-gradient(135deg, #6B8E23 0%, #5A7A1E 100%)'}}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-2" style={{color: '#3E2723'}}>GrainTrade ERP</h1>
          <p className="text-lg" style={{color: '#6B5846'}}>Sudarshan Trading Company</p>
        </div>

        <Card className="p-8 shadow-elevated" style={{background: 'white'}}>
          <form onSubmit={isRegister ? handleRegister : handleLogin}>
            <div className="space-y-5">
              {isRegister && (
                <>
                  <div>
                    <Label htmlFor="name" className="text-sm font-semibold" style={{color: '#3E2723'}}>Full Name</Label>
                    <Input
                      id="name"
                      data-testid="register-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role" className="text-sm font-semibold" style={{color: '#3E2723'}}>Role</Label>
                    <select
                      id="role"
                      data-testid="register-role-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="erp-select mt-2"
                    >
                      <option value="operator">Operator</option>
                      <option value="manager">Manager</option>
                      <option value="accountant">Accountant</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </>
              )}
              
              <div>
                <Label htmlFor="username" className="text-sm font-semibold" style={{color: '#3E2723'}}>Username</Label>
                <Input
                  id="username"
                  data-testid="login-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-sm font-semibold" style={{color: '#3E2723'}}>Password</Label>
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              
              <Button
                type="submit"
                data-testid="login-submit-button"
                disabled={loading}
                className="w-full btn-primary text-base py-6"
                style={{background: '#6B8E23'}}
              >
                {loading ? 'Processing...' : (isRegister ? 'Register' : 'Login')}
              </Button>
              
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-sm font-medium hover:underline"
                  style={{color: '#6B8E23'}}
                >
                  {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
                </button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;