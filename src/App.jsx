import { useState, useEffect } from "react";
import supabase from "./lib/supabase"; // Asegúrate de importar correctamente
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Items from "./pages/Items";
import Goals from "./pages/Goals";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("dashboard");

  // ✅ Obtener sesión al cargar la app
  useEffect(() => {
    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data?.session) {
        setSession(data.session);
      }
    };

    restoreSession();

    // ✅ Escuchar cambios de sesión y actualizaciones del token
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setSession(session);
        } else {
          setSession(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // ✅ Logout real
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setView("categories");
  };

  return (
    <>
      {!session ? (
        <div className="min-h-screen bg-white text-black p-6">
          <Login onLogin={() => setView("dashboard")} />
        </div>
      ) : (
        <AppLayout onLogout={handleLogout} setView={setView}>
          {view === "categories" && <Categories token={session.access_token} />}
          {view === "accounts" && <Accounts token={session.access_token} />}
          {view === "transactions" && <Transactions token={session.access_token} />}
          {view === "budgets" && <Budgets token={session.access_token} />}
          {view === "items" && <Items token={session.access_token} />}
          {view === "goals" && <Goals token={session.access_token} />}
          {view === "dashboard" && <Dashboard token={session.access_token} />}
        </AppLayout>
      )}

      <ToastContainer position="top-right" autoClose={5000} />
    </>
  );
}

export default App;
