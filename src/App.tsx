import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute, UserRoute } from './components/RouteGuards';
import { LoadingSpinner } from './components/LoadingSpinner';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ClientsPage } from './pages/ClientsPage';
import { EntriesPage } from './pages/EntriesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SetupPage } from './pages/SetupPage';
import { SignupPage } from './pages/SignupPage';
import { UsersPage } from './pages/UsersPage';
import { dashboardPath } from './utils/paths';

function RootRedirect() {
  const { user, loading, setupRequired } = useAuth();

  if (loading || setupRequired === null) {
    return <LoadingSpinner label="Loading SiNails…" />;
  }
  if (setupRequired) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={dashboardPath(user.role)} replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminRoute />}>
          <Route element={<AppLayout variant="admin" />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/appointments" element={<AppointmentsPage />} />
            <Route path="/admin/clients" element={<ClientsPage />} />
            <Route path="/admin/payments" element={<PaymentsPage />} />
            <Route path="/admin/expenses" element={<ExpensesPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            <Route path="/admin/services" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/settings" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
        </Route>

        <Route element={<UserRoute />}>
          <Route element={<AppLayout variant="user" />}>
            <Route path="/user/entries" element={<EntriesPage />} />
            <Route path="/user/expenses" element={<ExpensesPage />} />
            <Route path="/user/profile" element={<ProfilePage />} />
            <Route path="/user/dashboard" element={<Navigate to="/user/entries" replace />} />
            <Route path="/user/appointments" element={<Navigate to="/user/entries" replace />} />
            <Route path="/user/clients" element={<Navigate to="/user/entries" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="/employee/*" element={<Navigate to="/user/entries" replace />} />
      <Route path="/admin/employees" element={<Navigate to="/admin/users" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
