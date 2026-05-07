import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import ColorField from '../components/ColorField';
import { useGetThemeQuery, useSaveThemeMutation } from '../features/theme/themeApi';
import { pushToast } from '../features/ui/uiSlice';
import { markClean, markDirty } from '../features/theme/themeSlice';

const FIELDS = {
  primaryColor: '', secondaryColor: '', bgDefault: '', bgPaper: '',
  navbarBg: '', footerBg: '', footerText: '', fontFamily: '',
  logoHeight: '', logoWidth: '', enableFooter: 'true', footerContent: '',
  globalCSS: '',
};

export default function ThemePage() {
  const portal = useSelector((s) => s.theme.activePortal);
  const dirty = useSelector((s) => s.theme.isDirty);
  const d = useDispatch();
  const { data, isLoading } = useGetThemeQuery(portal);
  const [save, { isLoading: saving }] = useSaveThemeMutation();
  const [form, setForm] = useState(FIELDS);

  useEffect(() => {
    if (!data?.theme) return;
    const c = data.theme.custom || {};
    const pal = c.themes?.light?.palette || {};
    setForm({
      primaryColor: pal.primary?.main || '',
      secondaryColor: pal.secondary?.main || '',
      bgDefault: pal.background?.default || '',
      bgPaper: pal.background?.paper || '',
      navbarBg: c.appBar?.background || '',
      footerBg: c.footer?.background || '',
      footerText: c.footer?.color || '',
      fontFamily: c.themes?.light?.typography?.fontFamily || '',
      logoHeight: c.appBar?.logoHeight || '',
      logoWidth: c.appBar?.logoWidth || '',
      enableFooter: String(c.footer?.active ?? true),
      footerContent: c.footer?.text || '',
      globalCSS: c.globalCSSStyles || '',
    });
    d(markClean());
  }, [data, d]);

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); d(markDirty()); };
  const setE = (k) => (e) => set(k)(e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await save({ portal, body: form }).unwrap();
      d(pushToast(r.message, 'success'));
      d(markClean());
    } catch (err) {
      d(pushToast(err?.data?.message || 'Gagal simpan', 'error'));
    }
  };

  if (isLoading) return <Layout title="Theme"><div className="text-slate-500 text-sm">Loading…</div></Layout>;

  return (
    <Layout title={`Theme — ${portal}`}>
      <form onSubmit={submit} className="space-y-5 max-w-3xl">
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
          <h3 className="md:col-span-2 font-semibold">Color Palette</h3>
          <ColorField label="Primary" value={form.primaryColor} onChange={set('primaryColor')} />
          <ColorField label="Secondary" value={form.secondaryColor} onChange={set('secondaryColor')} />
          <ColorField label="Background Default" value={form.bgDefault} onChange={set('bgDefault')} />
          <ColorField label="Background Paper" value={form.bgPaper} onChange={set('bgPaper')} />
        </div>

        <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
          <h3 className="md:col-span-2 font-semibold">Navbar & Logo</h3>
          <ColorField label="Navbar Background" value={form.navbarBg} onChange={set('navbarBg')} />
          <div>
            <label className="label">Font Family</label>
            <input className="input" value={form.fontFamily} onChange={setE('fontFamily')} placeholder="Inter, sans-serif" />
          </div>
          <div>
            <label className="label">Logo Height (px)</label>
            <input className="input" type="number" value={form.logoHeight} onChange={setE('logoHeight')} />
          </div>
          <div>
            <label className="label">Logo Width (px)</label>
            <input className="input" type="number" value={form.logoWidth} onChange={setE('logoWidth')} />
          </div>
        </div>

        <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
          <h3 className="md:col-span-2 font-semibold">Footer</h3>
          <div>
            <label className="label">Enable Footer</label>
            <select className="input" value={form.enableFooter} onChange={setE('enableFooter')}>
              <option value="true">Active</option>
              <option value="false">Hidden</option>
            </select>
          </div>
          <div>
            <label className="label">Footer Text</label>
            <input className="input" value={form.footerContent} onChange={setE('footerContent')} />
          </div>
          <ColorField label="Footer Background" value={form.footerBg} onChange={set('footerBg')} />
          <ColorField label="Footer Text Color" value={form.footerText} onChange={set('footerText')} />
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">Global CSS</h3>
          <textarea
            value={form.globalCSS}
            onChange={setE('globalCSS')}
            rows={6}
            className="input font-mono text-xs"
            placeholder=".my-class { color: red; }"
          />
        </div>

        <div className="flex items-center gap-3 sticky bottom-0 bg-bg/80 backdrop-blur p-3 -mx-7 px-7 border-t border-white/10">
          <button type="submit" disabled={saving || !dirty} className="btn-primary disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan Tema'}
          </button>
          {dirty && <span className="text-xs text-amber-400">● Perubahan belum disimpan</span>}
        </div>
      </form>
    </Layout>
  );
}
