import Navbar from "./Navbar";

function AppLayout({ children, onLogout, setView }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-1)] via-[var(--bg-2)] to-[var(--bg-3)] text-[var(--text)]">

      <Navbar onLogout={onLogout} setView={setView} />

      <main className="p-6 md:p-8 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}

export default AppLayout;
