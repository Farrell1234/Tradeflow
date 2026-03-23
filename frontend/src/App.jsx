import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Particles from './components/Particles';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import SetupGuard from './components/SetupGuard';
import Dashboard from './pages/Dashboard';
import AlgoDetail from './pages/AlgoDetail';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Billing from './pages/Billing';

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        <Particles />
        <div id="scan-lines" />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected routes — require auth + active subscription + setup complete */}
            <Route path="/" element={
              <ProtectedRoute>
                <SetupGuard>
                  <Dashboard />
                </SetupGuard>
              </ProtectedRoute>
            } />
            <Route path="/algo/:id" element={
              <ProtectedRoute>
                <SetupGuard>
                  <AlgoDetail />
                </SetupGuard>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />

            {/* Billing — requires auth but NOT active subscription */}
            <Route path="/billing" element={
              <ProtectedRoute requireSubscription={false}>
                <Billing />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
