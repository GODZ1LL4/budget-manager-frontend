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
      const { error } = await supabase.auth.signInWithPassword({
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[var(--bg-1)] via-[var(--bg-2)] to-[var(--bg-3)] text-[var(--text)]">
      <div className="max-w-md w-full ff-card p-6 md:p-8">
        <h2 className="ff-h2 mb-2 text-center">
          <span className="ff-heading-accent">
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </span>
        </h2>

        <p className="text-xs text-[var(--muted)] mb-6 text-center">
          {isLogin
            ? "Ingresa con tu correo para ver tu panel financiero."
            : "Crea una cuenta para comenzar a registrar tus finanzas."}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* Email */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="ff-input"
              required
            />
          </div>

          {/* Password */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="ff-input"
              required
            />
            <p
              className="text-[11px]"
              style={{ color: "color-mix(in srgb, var(--muted) 75%, transparent)" }}
            >
              Usa una contraseña segura que solo tú conozcas.
            </p>
          </div>

          {/* Botón principal */}
          <button type="submit" className="ff-btn ff-btn-primary w-full mt-2">
            {isLogin ? "Iniciar sesión" : "Registrarse"}
          </button>
        </form>

        {/* Toggle login/registro */}
        <p className="mt-5 text-xs text-center text-[var(--muted)]">
          {isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            type="button"
            className="font-semibold underline underline-offset-2"
            style={{ color: "var(--primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            {isLogin ? "Crear una cuenta" : "Iniciar sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
