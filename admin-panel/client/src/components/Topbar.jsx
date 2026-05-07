import { useDispatch, useSelector } from 'react-redux';
import { setPortal } from '../features/theme/themeSlice';
import { useRestartMutation } from '../features/system/systemApi';
import { pushToast } from '../features/ui/uiSlice';

export default function Topbar({ title }) {
  const portal = useSelector((s) => s.theme.activePortal);
  const d = useDispatch();
  const [restart, { isLoading }] = useRestartMutation();

  const handleRestart = async () => {
    if (!confirm('Restart WSO2? Portal akan offline ~2-3 menit.')) return;
    try {
      const res = await restart().unwrap();
      d(pushToast(res.message, 'success'));
    } catch (e) {
      d(pushToast(e?.data?.message || 'Gagal restart', 'error'));
    }
  };

  return (
    <header className="h-15 px-7 py-3 border-b border-white/5 flex items-center justify-between bg-surface/50 backdrop-blur">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex items-center gap-3">
        <div className="flex bg-surface2 rounded-lg p-0.5 border border-white/10">
          {['devportal', 'publisher'].map((p) => (
            <button
              key={p}
              onClick={() => d(setPortal(p))}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                portal === p ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button onClick={handleRestart} disabled={isLoading} className="btn-secondary disabled:opacity-50">
          {isLoading ? 'Restarting...' : 'Restart WSO2'}
        </button>
      </div>
    </header>
  );
}
