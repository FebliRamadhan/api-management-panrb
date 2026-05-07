import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import { useGetThemeQuery, useSaveRawThemeMutation } from '../features/theme/themeApi';
import { pushToast } from '../features/ui/uiSlice';

export default function RawEditorPage() {
  const portal = useSelector((s) => s.theme.activePortal);
  const d = useDispatch();
  const { data } = useGetThemeQuery(portal);
  const [save, { isLoading }] = useSaveRawThemeMutation();
  const [content, setContent] = useState('');

  useEffect(() => { if (data?.raw) setContent(data.raw); }, [data]);

  const submit = async () => {
    try {
      const r = await save({ portal, content }).unwrap();
      d(pushToast(r.message, 'success'));
    } catch (err) {
      d(pushToast(err?.data?.message || 'Gagal simpan', 'error'));
    }
  };

  return (
    <Layout title={`Raw Editor — ${portal}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-amber-400">⚠ Edit langsung file <code>defaultTheme.js</code>. Backup otomatis akan dibuat.</p>
        <button onClick={submit} disabled={isLoading} className="btn-primary disabled:opacity-50">
          {isLoading ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="input font-mono text-xs"
        rows={28}
        spellCheck={false}
      />
    </Layout>
  );
}
