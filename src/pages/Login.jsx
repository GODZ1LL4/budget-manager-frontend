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
      onLogin(); // 🔄 Solo cambia la vista (ya no necesitas pasar el token)
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
    <div className="max-w-md mx-auto bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        {isLogin ? "Iniciar sesión" : "Crear cuenta"}
      </h2>

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:brightness-110 transition"
        >
          {isLogin ? "Iniciar sesión" : "Registrarse"}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-gray-600">
        {isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}{" "}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 underline"
        >
          {isLogin ? "Crear una cuenta" : "Iniciar sesión"}
        </button>
      </p>
    </div>
  );
}

export default Login;
