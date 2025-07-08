

import React, { useState, createContext, useContext, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from './types';
import Layout from './components/Layout';
import { CustomerNewDemandPage } from './pages/customer/CustomerNewDemandPage';
import CustomerMyDemandsPage from './pages/customer/CustomerMyDemandsPage';
import { ManufacturerNewStockPage } from './pages/manufacturer/ManufacturerNewStockPage';
import ManufacturerMyStockPage from './pages/manufacturer/ManufacturerMyStockPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import AdminStockManagementPage from './pages/admin/AdminStockManagementPage';
import { AdminMatchmakingPage } from './pages/admin/AdminMatchmakingPage';
import { AdminTruckPlanningPage } from './pages/admin/AdminTruckPlanningPage';
import AdminAiReportsPage from './pages/admin/AdminAiReportsPage';
import { AdminBillingPage } from './pages/admin/AdminBillingPage';
import { AdminLogisticsHubPage } from './pages/admin/AdminLogisticsHubPage';
import AdminCustomerLogisticsDetailsPage from './pages/admin/logistics/AdminCustomerLogisticsDetailsPage';
import AdminManufacturerLogisticsDetailsPage from './pages/admin/logistics/AdminManufacturerLogisticsDetailsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { useLocale } from './LocaleContext';
import LoginPage from './pages/LoginPage';
import { CustomerDashboardPage } from './pages/customer/CustomerDashboardPage'; 
import { ManufacturerDashboardPage } from './pages/manufacturer/ManufacturerDashboardPage';
import { MessagesPage } from './pages/MessagesPage';
import CustomerMatchesPage from './pages/customer/CustomerMatchesPage';
import ManufacturerMatchesPage from './pages/manufacturer/ManufacturerMatchesPage';
import CustomerDealsPage from './pages/customer/CustomerDealsPage';
import ManufacturerDealsPage from './pages/manufacturer/ManufacturerDealsPage';

interface AppContextType {
  userRole: UserRole | null;
  login: (role: UserRole) => void;
  logout: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

const ProtectedRoutes: React.FC<{ userRole: UserRole }> = ({ userRole }) => {
    const { t } = useLocale();

    return (
        <Layout>
            <Routes>
                {/* Common routes available to all logged-in users */}
                <Route path="/messages" element={<MessagesPage />} />

                {/* Role-specific routes */}
                {userRole === UserRole.CUSTOMER && (
                    <>
                        <Route path="/" element={<Navigate to="/customer/dashboard" replace />} />
                        <Route path="/customer/dashboard" element={<CustomerDashboardPage />} />
                        <Route path="/customer/new-demand" element={<CustomerNewDemandPage />} />
                        <Route path="/customer/my-demands" element={<CustomerMyDemandsPage />} />
                        <Route path="/customer/matches" element={<CustomerMatchesPage />} />
                        <Route path="/customer/deals" element={<CustomerDealsPage />} />
                    </>
                )}
                {userRole === UserRole.MANUFACTURER && (
                    <>
                        <Route path="/" element={<Navigate to="/manufacturer/dashboard" replace />} />
                        <Route path="/manufacturer/dashboard" element={<ManufacturerDashboardPage />} />
                        <Route path="/manufacturer/new-stock" element={<ManufacturerNewStockPage />} />
                        <Route path="/manufacturer/my-stock" element={<ManufacturerMyStockPage />} />
                        <Route path="/manufacturer/matches" element={<ManufacturerMatchesPage />} />
                        <Route path="/manufacturer/deals" element={<ManufacturerDealsPage />} />
                    </>
                )}
                {userRole === UserRole.ADMIN && (
                    <>
                        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                        <Route path="/admin/users" element={<AdminUsersPage />} />
                        <Route path="/admin/stock-management" element={<AdminStockManagementPage />} />
                        <Route path="/admin/matchmaking" element={<AdminMatchmakingPage />} />
                        <Route path="/admin/logistics-hub" element={<AdminLogisticsHubPage />} />
                        <Route path="/admin/logistics-hub/customer/:customerId" element={<AdminCustomerLogisticsDetailsPage />} />
                        <Route path="/admin/logistics-hub/manufacturer/:manufacturerId" element={<AdminManufacturerLogisticsDetailsPage />} />
                        <Route path="/admin/truck-planning" element={<AdminTruckPlanningPage />} />
                        <Route path="/admin/billing" element={<AdminBillingPage />} />
                        <Route path="/admin/ai-reports" element={<AdminAiReportsPage />} />
                    </>
                )}
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route
                    path="*"
                    element={<PlaceholderPage title={t('pageNotFoundTitle')} message={t('pageNotFoundMessage')} />}
                />
            </Routes>
        </Layout>
    );
};

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const login = (role: UserRole) => {
    setUserRole(role);
  };

  const logout = () => {
    setUserRole(null);
  };

  const contextValue = useMemo(() => ({ userRole, login, logout }), [userRole]);

  return (
    <AppContext.Provider value={contextValue}>
      <Routes>
        {userRole ? (
          <Route path="/*" element={<ProtectedRoutes userRole={userRole} />} />
        ) : (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </AppContext.Provider>
  );
};

export default App;