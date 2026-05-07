import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { dismissToast } from '../features/ui/uiSlice';

const KIND = {
  success: 'bg-green-600/15 border-green-500/30 text-green-300',
  error: 'bg-red-600/15 border-red-500/30 text-red-300',
  info: 'bg-blue-600/15 border-blue-500/30 text-blue-300',
};

function ToastItem({ t }) {
  const d = useDispatch();
  useEffect(() => {
    const timer = setTimeout(() => d(dismissToast(t.id)), 4000);
    return () => clearTimeout(timer);
  }, [t.id, d]);
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm shadow-lg ${KIND[t.kind] || KIND.info}`}>
      {t.msg}
    </div>
  );
}

export default function Toast() {
  const toasts = useSelector((s) => s.ui.toasts);
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}
