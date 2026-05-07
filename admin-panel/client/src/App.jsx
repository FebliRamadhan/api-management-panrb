import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ThemePage from './pages/ThemePage';
import ImagesPage from './pages/ImagesPage';
import RawEditorPage from './pages/RawEditorPage';
import CustomPagesPage from './pages/CustomPagesPage';

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/theme" element={<Protected><ThemePage /></Protected>} />
      <Route path="/images" element={<Protected><ImagesPage /></Protected>} />
      <Route path="/raw" element={<Protected><RawEditorPage /></Protected>} />
      <Route path="/pages" element={<Protected><CustomPagesPage /></Protected>} />
      <Route path="*" element={<div className="h-full flex items-center justify-center text-slate-500">404</div>} />
    </Routes>
  );
}
