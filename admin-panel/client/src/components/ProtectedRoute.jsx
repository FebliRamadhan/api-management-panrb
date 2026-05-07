import { Navigate } from 'react-router-dom';
import { useMeQuery } from '../features/auth/authApi';

export default function ProtectedRoute({ children }) {
  const { data, isLoading, isError } = useMeQuery();
  if (isLoading) return <div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading...</div>;
  if (isError || !data?.username) return <Navigate to="/login" replace />;
  return children;
}
