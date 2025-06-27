import Navbar from "./Navbar";

function AppLayout({ children, onLogout, setView }) {
  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <Navbar onLogout={onLogout} setView={setView} />
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}

export default AppLayout;
