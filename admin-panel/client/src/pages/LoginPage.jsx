import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLoginMutation, useAuthConfigQuery } from '../features/auth/authApi';

export default function LoginPage() {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [login, { isLoading }] = useLoginMutation();
  const { data: authCfg } = useAuthConfigQuery();
  const nav = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const ssoErr = params.get('sso_error');
    if (ssoErr) setErr(`SSO gagal: ${ssoErr}`);
  }, [params]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await login({ username, password }).unwrap();
      if (r.success) nav(r.redirect || '/', { replace: true });
    } catch (e) {
      setErr(e?.data?.message || 'Login gagal');
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white font-bold text-lg">W</div>
          <h1 className="font-display text-xl font-bold">WSO2 Admin Panel</h1>
          <p className="text-xs text-slate-500 mt-1">Masuk untuk mengelola tema & halaman</p>
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setU(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setP(e.target.value)} required />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center disabled:opacity-50">
          {isLoading ? 'Loading...' : 'Login'}
        </button>

        {authCfg?.sso_enabled && (
          <>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex-1 h-px bg-slate-700" />
              atau
              <span className="flex-1 h-px bg-slate-700" />
            </div>
            <a
              href="/api/auth/login"
              className="btn-secondary w-full justify-center inline-flex items-center gap-2"
            >
              Login dengan SADA SSO
            </a>
          </>
        )}
      </form>
    </div>
  );
}
