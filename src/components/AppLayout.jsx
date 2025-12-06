import Navbar from "./Navbar";

function AppLayout({ children, onLogout, setView }) {
  return (
    <div
      className="
    min-h-screen
    bg-gradient-to-br from-[#0c0f14] via-[#0f1115] to-[#0a0c10]
    text-slate-100
    font-sans
  "
    >
      <Navbar onLogout={onLogout} setView={setView} />

      <main className="p-6 md:p-8 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}

export default AppLayout;
