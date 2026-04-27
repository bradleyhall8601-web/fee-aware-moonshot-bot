import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import Signals from './pages/Signals';
import Users from './pages/Users';
import Settings from './pages/Settings';
import SystemStatus from './pages/SystemStatus';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="trades"     element={<Trades />} />
        <Route path="signals"    element={<Signals />} />
        <Route path="users"      element={<Users />} />
        <Route path="settings"   element={<Settings />} />
        <Route path="system"     element={<SystemStatus />} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
