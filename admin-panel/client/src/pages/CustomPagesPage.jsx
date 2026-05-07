import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import {
  useListPagesQuery,
  useGetPageQuery,
  useSavePageMutation,
  useDeletePageMutation,
  useGetMenuQuery,
  useSaveMenuMutation,
} from '../features/pages/pagesApi';
import { pushToast } from '../features/ui/uiSlice';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function PageEditor({ portal, slug, onClose }) {
  const d = useDispatch();
  const isNew = slug === '__new__';
  const { data, isFetching } = useGetPageQuery({ portal, slug }, { skip: isNew });
  const [save, { isLoading: saving }] = useSavePageMutation();

  const [newSlug, setNewSlug] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('# Halaman Baru\n\nTulis konten di sini…');

  useEffect(() => {
    if (isNew) return;
    if (data) {
      setTitle(data.title || '');
      setContent(data.content || '');
    }
  }, [data, isNew]);

  const submit = async (e) => {
    e.preventDefault();
    const target = isNew ? newSlug : slug;
    if (!SLUG_RE.test(target)) {
      d(pushToast('Slug harus huruf kecil/angka/dash, min 1 char', 'error'));
      return;
    }
    if (!title.trim()) { d(pushToast('Title wajib diisi', 'error')); return; }
    try {
      const r = await save({ portal, slug: target, title, content }).unwrap();
      d(pushToast(r.message, 'success'));
      onClose();
    } catch (err) {
      d(pushToast(err?.data?.message || 'Gagal simpan', 'error'));
    }
  };

  if (!isNew && isFetching) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{isNew ? 'Halaman Baru' : `Edit: ${slug}`}</h3>
        <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-200">← Kembali</button>
      </div>

      {isNew && (
        <div>
          <label className="label">Slug (URL)</label>
          <input className="input font-mono" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="contoh: about-us" />
          <p className="text-xs text-slate-500 mt-1">Akan tampil di <code>/devportal/site/pages/&lt;slug&gt;</code></p>
        </div>
      )}

      <div>
        <label className="label">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div>
        <label className="label">Content (Markdown)</label>
        <textarea
          className="input font-mono text-xs"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          spellCheck={false}
        />
        <p className="text-xs text-slate-500 mt-1">Mendukung heading (#), bold (**), italic (*), list (-), link, dan inline code.</p>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}

function MenuEditor({ portal }) {
  const d = useDispatch();
  const { data } = useGetMenuQuery(portal);
  const [save, { isLoading }] = useSaveMenuMutation();
  const [items, setItems] = useState([]);

  useEffect(() => { setItems(data?.items || []); }, [data]);

  const update = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const add = () => setItems([...items, { label: '', href: '' }]);
  const remove = (i) => setItems(items.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const submit = async () => {
    try {
      const r = await save({ portal, items }).unwrap();
      d(pushToast(r.message, 'success'));
    } catch (err) {
      d(pushToast(err?.data?.message || 'Gagal simpan menu', 'error'));
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Menu Navigasi</h3>
        <div className="flex gap-2">
          <button onClick={add} className="btn-secondary text-xs">+ Item</button>
          <button onClick={submit} disabled={isLoading} className="btn-primary text-xs disabled:opacity-50">
            {isLoading ? 'Menyimpan…' : 'Simpan Menu'}
          </button>
        </div>
      </div>
      {items.length === 0 && <p className="text-xs text-slate-500">Belum ada item menu.</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className="input flex-1" placeholder="Label" value={it.label} onChange={(e) => update(i, 'label', e.target.value)} />
            <input className="input flex-1 font-mono text-xs" placeholder="/devportal/pages/about" value={it.href} onChange={(e) => update(i, 'href', e.target.value)} />
            <button onClick={() => move(i, -1)} className="text-slate-500 hover:text-slate-200 px-2">↑</button>
            <button onClick={() => move(i, 1)} className="text-slate-500 hover:text-slate-200 px-2">↓</button>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300 px-2">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomPagesPage() {
  const portal = useSelector((s) => s.theme.activePortal);
  const d = useDispatch();
  const { data } = useListPagesQuery(portal);
  const [del] = useDeletePageMutation();
  const [editing, setEditing] = useState(null);

  const onDelete = async (slug) => {
    if (!confirm(`Hapus page "${slug}"?`)) return;
    try {
      const r = await del({ portal, slug }).unwrap();
      d(pushToast(r.message, 'success'));
    } catch (err) {
      d(pushToast(err?.data?.message || 'Gagal hapus', 'error'));
    }
  };

  if (editing) {
    return (
      <Layout title={`Pages — ${portal}`}>
        <div className="card max-w-3xl">
          <PageEditor portal={portal} slug={editing} onClose={() => setEditing(null)} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Custom Pages — ${portal}`}>
      <div className="space-y-5">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Halaman ({data?.pages?.length || 0})</h3>
            <button onClick={() => setEditing('__new__')} className="btn-primary text-xs">+ Halaman Baru</button>
          </div>
          {(!data?.pages || data.pages.length === 0) && (
            <p className="text-sm text-slate-500">Belum ada custom page. Klik tombol di atas untuk membuat.</p>
          )}
          <div className="divide-y divide-white/5">
            {data?.pages?.map((p) => (
              <div key={p.slug} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-slate-500 font-mono">/{p.slug}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(p.slug)} className="btn-secondary text-xs">Edit</button>
                  <button onClick={() => onDelete(p.slug)} className="text-xs text-red-400 hover:text-red-300 px-2">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <MenuEditor portal={portal} />
      </div>
    </Layout>
  );
}
