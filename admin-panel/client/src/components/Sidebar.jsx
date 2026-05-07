import { NavLink } from 'react-router-dom';
import { useStatusQuery } from '../features/system/systemApi';
import { useLogoutMutation } from '../features/auth/authApi';

const NAV = [
  { to: '/', label: 'Dashboard', section: 'main' },
  { to: '/theme', label: 'Theme', section: 'main' },
  { to: '/pages', label: 'Custom Pages', section: 'main' },
  { to: '/images', label: 'Images', section: 'assets' },
  { to: '/raw', label: 'Raw Editor', section: 'assets' },
];

export default function Sidebar() {
  const { data: status } = useStatusQuery(undefined, { pollingInterval: 15000 });
  const [logout] = useLogoutMutation();
  const running = status?.status === 'running';

  const sections = [...new Set(NAV.map((n) => n.section))];

  return (
    <aside className="w-60 bg-surface border-r border-white/5 flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent2 mb-3 flex items-center justify-center text-white font-bold">W</div>
        <h1 className="font-display text-base font-bold">WSO2 Admin</h1>
        <p className="text-xs text-slate-500 mt-0.5">Theme & Pages Manager</p>
      </div>

      <nav className="flex-1 p-3">
        {sections.map((sec) => (
          <div key={sec} className="mb-6">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">{sec}</p>
            {NAV.filter((n) => n.section === sec).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `block text-sm px-3 py-2 rounded-lg mb-0.5 transition ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 text-xs">
          <span className={`w-2 h-2 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div>
            <div className="text-slate-200">WSO2 {status?.status || '...'}</div>
            <div className="text-slate-500 text-[10px]">{status?.container || 'wso2-apim'}</div>
          </div>
        </div>
        <button
          onClick={() => logout().then(() => (window.location.href = '/login'))}
          className="w-full text-left px-3 py-2 mt-2 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
