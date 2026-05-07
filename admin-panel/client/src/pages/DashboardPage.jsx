import Layout from '../components/Layout';
import { useStatusQuery } from '../features/system/systemApi';
import { useMeQuery } from '../features/auth/authApi';

function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="text-2xl font-display font-bold">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: status } = useStatusQuery();
  const { data: me } = useMeQuery();
  return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Container Status" value={status?.status || '...'} hint={status?.container} />
        <Stat label="Logged in as" value={me?.username || '-'} />
        <Stat label="Portal" value="DevPortal + Publisher" hint="2 portal aktif" />
      </div>
      <div className="card">
        <h3 className="font-semibold mb-2">Quick Actions</h3>
        <p className="text-sm text-slate-400">Pilih menu di sidebar untuk mulai mengubah tema, mengelola gambar, atau membuat custom page.</p>
      </div>
    </Layout>
  );
}
