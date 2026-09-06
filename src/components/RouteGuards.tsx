import { Navigate, Outlet } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../utils/paths';

export function ProtectedRoute() {
  const { user, loading, setupRequired } = useAuth();

  if (loading) return <LoadingSpinner label="Loading SiNails…" />;
  if (setupRequired) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <LoadingSpinner label="Loading SiNails…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to={dashboardPath('USER')} replace />;
  return <Outlet />;
}

export function UserRoute() {
  const { user, loading, isUser, isAdmin } = useAuth();

  if (loading) return <LoadingSpinner label="Loading SiNails…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to={dashboardPath('ADMIN')} replace />;
  if (!isUser) return <Navigate to="/login" replace />;
  return <Outlet />;
}
