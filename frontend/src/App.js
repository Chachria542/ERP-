import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import WeighbridgePage from "./pages/WeighbridgePage";
import CustodyPage from "./pages/CustodyPage";
import PurchasePage from "./pages/PurchasePage";
import FarmerPaymentPage from "./pages/FarmerPaymentPage";
import PreEntryPage from "./pages/PreEntryPage";
import SalesPage from "./pages/SalesPage";
import ProductionPage from "./pages/ProductionPage";
import LedgerPage from "./pages/LedgerPage";
import MasterDataPage from "./pages/MasterDataPage";
import ReportsPage from "./pages/ReportsPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/" 
            element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/weighbridge" 
            element={user ? <WeighbridgePage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/custody" 
            element={user ? <CustodyPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/purchases" 
            element={user ? <PurchasePage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/pre-entry" 
            element={user ? <PreEntryPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/farmer-payment" 
            element={user ? <FarmerPaymentPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/sales" 
            element={user ? <SalesPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/production" 
            element={user ? <ProductionPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/ledger" 
            element={user ? <LedgerPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/master-data" 
            element={user ? <MasterDataPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/reports" 
            element={user ? <ReportsPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
