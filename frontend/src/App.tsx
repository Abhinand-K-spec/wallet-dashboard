import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store/store';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DepositPage from './pages/DepositPage';
import WithdrawPage from './pages/WithdrawPage';
import HistoryPage from './pages/HistoryPage';
import AdminDepositsPage from './pages/AdminDepositsPage';
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage';

const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode, allowedRoles?: string[] }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

import { ToastContainer } from './components/ToastContainer';

function App() {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  return (
    <Router>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={
            user?.role === 'ADMIN' ? <AdminDashboard /> : <UserDashboard />
          } />
          <Route path="deposit" element={<DepositPage />} />
          <Route path="withdraw" element={<WithdrawPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="admin/deposits" element={
            <ProtectedRoute allowedRoles={['ADMIN']}><AdminDepositsPage /></ProtectedRoute>
          } />
          <Route path="admin/withdrawals" element={
            <ProtectedRoute allowedRoles={['ADMIN']}><AdminWithdrawalsPage /></ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
