import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProductionDataProvider } from './context/ProductionDataContext';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/LoginPage';
import { Overview } from './pages/Overview';
import { OeeProduction } from './pages/OeeProduction';
import { BottleneckIntelligence } from './pages/BottleneckIntelligence';
import { RootCauseExplorer } from './pages/RootCauseExplorer';
import { LossAnalysis } from './pages/LossAnalysis';
import { TargetRisk } from './pages/TargetRisk';
import { WhatIfSimulator } from './pages/WhatIfSimulator';
import { ProductionRiskRadar } from './pages/ProductionRiskRadar';
import { ActionCenter } from './pages/ActionCenter';
import { ImprovementTracking } from './pages/ImprovementTracking';
import { DataManagement } from './pages/DataManagement';
import { Settings } from './pages/Settings';

// Authentication guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-300 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>Authenticating FLOWFORGE AI terminal...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Admin Role Guard: Operators are restricted to production monitoring features only
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'Admin') {
    // Operator is restricted from system configuration / deep admin features
    return <Navigate to="/oee" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProductionDataProvider>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Dashboard Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Production Monitoring Features (Accessible to both Admin and Operator) */}
              <Route path="/" element={<Overview />} />
              <Route path="/oee" element={<OeeProduction />} />
              <Route path="/risk-radar" element={<ProductionRiskRadar />} />
              <Route path="/ai-insights" element={<Navigate to="/risk-radar" replace />} />

              {/* Admin & Configuration Features (Admin Only) */}
              <Route
                path="/bottlenecks"
                element={
                  <AdminRoute>
                    <BottleneckIntelligence />
                  </AdminRoute>
                }
              />
              <Route
                path="/root-causes"
                element={
                  <AdminRoute>
                    <RootCauseExplorer />
                  </AdminRoute>
                }
              />
              <Route
                path="/losses"
                element={
                  <AdminRoute>
                    <LossAnalysis />
                  </AdminRoute>
                }
              />
              <Route
                path="/target-risk"
                element={
                  <AdminRoute>
                    <TargetRisk />
                  </AdminRoute>
                }
              />
              <Route
                path="/simulator"
                element={
                  <AdminRoute>
                    <WhatIfSimulator />
                  </AdminRoute>
                }
              />
              <Route
                path="/actions"
                element={
                  <AdminRoute>
                    <ActionCenter />
                  </AdminRoute>
                }
              />
              <Route
                path="/improvements"
                element={
                  <AdminRoute>
                    <ImprovementTracking />
                  </AdminRoute>
                }
              />
              {/* Data Management: Both Admin & Operator can upload datasets */}
              {/* Role-aware UI inside the page hides admin-only actions from Operators */}
              <Route
                path="/data-management"
                element={
                  <ProtectedRoute>
                    <DataManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <AdminRoute>
                    <Settings />
                  </AdminRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ProductionDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
