import Navbar from "./Navbar";

function AppLayout({
  children,
  onLogout,
  setView,
  contentWidth = "default",
  subscriptionMode,
}) {
  const widthClass =
    contentWidth === "dashboard"
      ? "w-full max-w-[1720px] mx-auto"
      : "w-full max-w-6xl mx-auto";

  return (
    <div className="app-shell app-shell--safe-bottom bg-gradient-to-br from-[var(--bg-1)] via-[var(--bg-2)] to-[var(--bg-3)] text-[var(--text)]">
      <Navbar
        onLogout={onLogout}
        setView={setView}
        subscriptionMode={subscriptionMode}
      />
      <main className={`p-4 md:p-6 xl:p-8 ${widthClass}`}>{children}</main>
    </div>
  );
}

export default AppLayout;
