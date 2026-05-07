import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Toast from './Toast';

export default function Layout({ title, children }) {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-7">{children}</main>
      </div>
      <Toast />
    </div>
  );
}
