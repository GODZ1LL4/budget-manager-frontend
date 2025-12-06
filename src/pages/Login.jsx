import { useState } from "react";
import supabase from "../lib/supabase";
import { toast } from "react-toastify";

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true); // Alternar entre login y registro
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Email y contraseña son obligatorios");
      return;
    }

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Login fallido: " + error.message);
        return;
      }

      toast.success("Inicio de sesión exitoso");
      onLogin(); // 🔄 Solo cambia la vista
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error("Registro fallido: " + error.message);
        return;
      }

      const userId = data?.user?.id;
      if (userId) {
        const { error: dbError } = await supabase.from("users").insert({
          id: userId,
          email,
        });

        if (dbError) {
          toast.error("No se pudo crear el usuario en la base de datos");
          console.error(dbError);
          return;
        }

        toast.success("Registro exitoso");
        setIsLogin(true);
      } else {
        toast.error("No se pudo obtener el ID del usuario");
      }
    }
  };

  return (
    <div
      className="
        max-w-md mx-auto mt-16
        rounded-2xl p-6 md:p-8
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
        border border-slate-800
        shadow-[0_20px_60px_rgba(0,0,0,0.85)]
        text-slate-200
      "
    >
      <h2 className="text-2xl font-bold mb-2 text-[#f6e652] text-center">
        {isLogin ? "Iniciar sesión" : "Crear cuenta"}
      </h2>
      <p className="text-xs text-slate-400 mb-6 text-center">
        {isLogin
          ? "Ingresa con tu correo para ver tu panel financiero."
          : "Crea una cuenta para comenzar a registrar tus finanzas."}
      </p>

      <form onSubmit={handleAuth} className="space-y-4">
        {/* Email */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          />
        </div>

        {/* Password */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          />
          <p className="text-[11px] text-slate-500">
            Usa una contraseña segura que solo tú conozcas.
          </p>
        </div>

        {/* Botón principal */}
        <button
          type="submit"
          className="
            w-full mt-2
            inline-flex items-center justify-center
            px-4 py-2.5 text-sm font-semibold
            rounded-lg
            bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
            text-slate-950
            shadow-[0_0_20px_rgba(16,185,129,0.7)]
            hover:brightness-110
            active:scale-95
            transition-all
          "
        >
          {isLogin ? "Iniciar sesión" : "Registrarse"}
        </button>
      </form>

      {/* Toggle login/registro */}
      <p className="mt-5 text-xs text-center text-slate-400">
        {isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}{" "}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="
            font-semibold
            text-emerald-300 hover:text-emerald-200
            underline underline-offset-2
            transition-colors
          "
          type="button"
        >
          {isLogin ? "Crear una cuenta" : "Iniciar sesión"}
        </button>
      </p>
    </div>
  );
}

export default Login;
