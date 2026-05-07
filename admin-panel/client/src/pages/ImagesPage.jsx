import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import { useListImagesQuery, useUploadImageMutation, useDeleteImageMutation } from '../features/images/imagesApi';
import { pushToast } from '../features/ui/uiSlice';

export default function ImagesPage() {
  const portal = useSelector((s) => s.theme.activePortal);
  const d = useDispatch();
  const { data } = useListImagesQuery(portal);
  const [upload, { isLoading: up }] = useUploadImageMutation();
  const [del] = useDeleteImageMutation();
  const fileRef = useRef();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await upload({ portal, file }).unwrap();
      d(pushToast(r.message, 'success'));
    } catch (err) {
      d(pushToast(err?.data?.message || 'Upload gagal', 'error'));
    } finally {
      e.target.value = '';
    }
  };

  const onDelete = async (filename) => {
    if (!confirm(`Hapus ${filename}?`)) return;
    try {
      const r = await del({ portal, filename }).unwrap();
      d(pushToast(r.message, 'success'));
    } catch (err) {
      d(pushToast(err?.data?.message || 'Hapus gagal', 'error'));
    }
  };

  return (
    <Layout title={`Images — ${portal}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">{data?.images?.length || 0} file</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={up} className="btn-primary disabled:opacity-50">
          {up ? 'Uploading…' : 'Upload Image'}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.images?.map((f) => (
          <div key={f} className="card p-3">
            <div className="aspect-square bg-surface2 rounded-lg flex items-center justify-center overflow-hidden mb-2">
              <img src={`/custom-assets/${f}`} alt={f} className="max-w-full max-h-full object-contain" />
            </div>
            <p className="text-xs font-mono truncate" title={f}>{f}</p>
            <button onClick={() => onDelete(f)} className="text-xs text-red-400 hover:text-red-300 mt-1">Hapus</button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
