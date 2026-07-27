import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  HiOutlineCheckCircle,
  HiOutlineLockClosed,
  HiOutlineMail,
} from "react-icons/hi";
import supabase from "../lib/supabase";
import {
  getAuthErrorMessage,
  PASSWORD_MIN_LENGTH,
} from "../lib/authMessages";
import {
  AUTH_ACTIONS,
  getAuthRedirectUrl,
} from "../lib/authRedirect";
import PasswordInput from "../components/PasswordInput";

const MODES = {
  login: "login",
  register: "register",
  forgot: "forgot",
  updatePassword: "updatePassword",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODE_COPY = {
  [MODES.login]: {
    title: "Iniciar sesion",
    description: "Ingresa con tu correo para ver tu panel financiero.",
    button: "Iniciar sesion",
    loading: "Validando acceso...",
  },
  [MODES.register]: {
    title: "Crear cuenta",
    description: "Crea una cuenta y confirma tu correo para activarla.",
    button: "Registrarse",
    loading: "Creando cuenta...",
  },
  [MODES.forgot]: {
    title: "Recuperar contrasena",
    description: "Te enviaremos un enlace seguro para definir una nueva.",
    button: "Enviar enlace",
    loading: "Enviando enlace...",
  },
  [MODES.updatePassword]: {
    title: "Nueva contrasena",
    description: "Define una contrasena nueva para continuar con tu cuenta.",
    button: "Guardar contrasena",
    loading: "Actualizando...",
  },
};

const isDuplicateUserRowError = (error) => {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("23505") || text.includes("duplicate");
};

function Login({
  onLogin,
  initialMode = MODES.login,
  onPasswordUpdated,
  onCancelPasswordUpdate,
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = MODE_COPY[mode] || MODE_COPY[MODES.login];
  const isLogin = mode === MODES.login;
  const isRegister = mode === MODES.register;
  const isForgot = mode === MODES.forgot;
  const isUpdatePassword = mode === MODES.updatePassword;

  useEffect(() => {
    setMode(initialMode);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
  }, [initialMode]);

  const primaryIcon = useMemo(() => {
    if (isForgot) return HiOutlineMail;
    if (isUpdatePassword) return HiOutlineCheckCircle;
    return HiOutlineLockClosed;
  }, [isForgot, isUpdatePassword]);

  const PrimaryIcon = primaryIcon;

  const showNotice = (type, message) => {
    setNotice({ type, message });

    if (type === "success") {
      toast.success(message);
      return;
    }

    if (type === "info") {
      toast.info(message);
      return;
    }

    toast.error(message);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
  };

  const validateEmail = () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      showNotice("error", "Ingresa tu correo electronico.");
      return null;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      showNotice("error", "El correo no parece valido. Revisa que este bien escrito.");
      return null;
    }

    return normalizedEmail;
  };

  const validatePassword = ({ requireConfirmation = false } = {}) => {
    if (!password) {
      showNotice("error", "Ingresa una contrasena.");
      return false;
    }

    if ((isRegister || isUpdatePassword) && password.length < PASSWORD_MIN_LENGTH) {
      showNotice(
        "error",
        `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
      );
      return false;
    }

    if (requireConfirmation && !confirmPassword) {
      showNotice("error", "Confirma la contrasena para continuar.");
      return false;
    }

    if (requireConfirmation && password !== confirmPassword) {
      showNotice("error", "La contrasena y la confirmacion no coinciden.");
      return false;
    }

    return true;
  };

  const createUserRow = async (userId, normalizedEmail, hasSession) => {
    if (!userId) {
      return true;
    }

    const { error } = await supabase.from("users").insert({
      id: userId,
      email: normalizedEmail,
    });

    if (!error || isDuplicateUserRowError(error)) {
      return true;
    }

    console.error("No se pudo crear el perfil del usuario", error);

    if (!hasSession) {
      return true;
    }

    showNotice(
      "error",
      "La cuenta se creo, pero no pudimos preparar el perfil. Intenta iniciar sesion otra vez."
    );
    return false;
  };

  const handleLogin = async (normalizedEmail) => {
    if (!validatePassword()) {
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      showNotice("error", getAuthErrorMessage(error, "login"));
      return;
    }

    if (!data?.session) {
      showNotice(
        "error",
        "No recibimos una sesion valida. Intenta iniciar sesion nuevamente."
      );
      return;
    }

    await onLogin?.(data.session);
    showNotice("success", "Inicio de sesion exitoso.");
  };

  const handleRegister = async (normalizedEmail) => {
    if (!validatePassword({ requireConfirmation: true })) {
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(AUTH_ACTIONS.confirmEmail),
      },
    });

    if (error) {
      showNotice("error", getAuthErrorMessage(error, "register"));
      return;
    }

    const hasSession = Boolean(data?.session);
    const profileReady = await createUserRow(
      data?.user?.id,
      normalizedEmail,
      hasSession
    );

    if (!profileReady) {
      return;
    }

    if (hasSession) {
      await onLogin?.(data.session);
      showNotice("success", "Cuenta creada. Ya puedes usar FinanceFlow.");
      return;
    }

    switchMode(MODES.login);
    showNotice(
      "success",
      `Te enviamos un correo de confirmacion a ${normalizedEmail}. Abre ese enlace para activar tu cuenta.`
    );
  };

  const handleForgotPassword = async (normalizedEmail) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: getAuthRedirectUrl(AUTH_ACTIONS.resetPassword),
      }
    );

    if (error) {
      showNotice("error", getAuthErrorMessage(error, "reset"));
      return;
    }

    showNotice(
      "success",
      `Te enviamos un enlace para cambiar tu contrasena a ${normalizedEmail}.`
    );
  };

  const handleUpdatePassword = async () => {
    if (!validatePassword({ requireConfirmation: true })) {
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      showNotice("error", getAuthErrorMessage(error, "updatePassword"));
      return;
    }

    setPassword("");
    setConfirmPassword("");
    showNotice("success", "Contrasena actualizada correctamente.");
    await onPasswordUpdated?.(data?.user || null);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setNotice(null);

    const normalizedEmail =
      isUpdatePassword ? email.trim() || null : validateEmail();

    if (!isUpdatePassword && !normalizedEmail) {
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        await handleLogin(normalizedEmail);
        return;
      }

      if (isRegister) {
        await handleRegister(normalizedEmail);
        return;
      }

      if (isForgot) {
        await handleForgotPassword(normalizedEmail);
        return;
      }

      await handleUpdatePassword();
    } finally {
      setSubmitting(false);
    }
  };

  const noticeStyles =
    notice?.type === "success"
      ? {
          borderColor: "color-mix(in srgb, var(--success) 38%, var(--border-rgba))",
          background: "color-mix(in srgb, var(--success) 12%, var(--panel))",
        }
      : notice?.type === "info"
      ? {
          borderColor: "color-mix(in srgb, var(--warning) 38%, var(--border-rgba))",
          background: "color-mix(in srgb, var(--warning) 12%, var(--panel))",
        }
      : {
          borderColor: "color-mix(in srgb, var(--danger) 38%, var(--border-rgba))",
          background: "color-mix(in srgb, var(--danger) 12%, var(--panel))",
        };

  return (
    <div className="app-shell app-shell--safe-top app-shell--safe-bottom flex items-center justify-center px-6 py-6 sm:px-8 bg-gradient-to-br from-[var(--bg-1)] via-[var(--bg-2)] to-[var(--bg-3)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[28rem] ff-card p-6 md:p-8">
        <div className="mb-5 flex justify-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 38%, var(--border-rgba))",
              background: "color-mix(in srgb, var(--primary) 12%, var(--panel))",
              color: "var(--primary)",
            }}
          >
            <PrimaryIcon className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>

        <h2 className="ff-h2 mb-2 text-center">
          <span className="ff-heading-accent">{copy.title}</span>
        </h2>

        <p className="mb-5 text-center text-xs text-[var(--muted)]">
          {copy.description}
        </p>

        {!isUpdatePassword && (
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-rgba)] bg-[color-mix(in_srgb,var(--panel-2)_65%,transparent)] p-1">
            <button
              type="button"
              onClick={() => switchMode(MODES.login)}
              disabled={submitting}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isLogin
                  ? "bg-[var(--primary)] text-[var(--primary-contrast,var(--bg-1))]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => switchMode(MODES.register)}
              disabled={submitting}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isRegister
                  ? "bg-[var(--primary)] text-[var(--primary-contrast,var(--bg-1))]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {notice && (
          <div
            className="mb-4 rounded-lg border px-3 py-2 text-sm"
            style={{ ...noticeStyles, color: "var(--text)" }}
          >
            {notice.message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isUpdatePassword && (
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Correo electronico</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ejemplo@correo.com"
                className="ff-input"
                autoComplete="email"
                disabled={submitting}
                required
              />
            </div>
          )}

          {!isForgot && (
            <div className="flex flex-col space-y-1">
              <label className="ff-label">
                {isUpdatePassword ? "Nueva contrasena" : "Contrasena"}
              </label>
              <PasswordInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  isLogin ? "Tu contrasena" : `Minimo ${PASSWORD_MIN_LENGTH} caracteres`
                }
                autoComplete={isLogin ? "current-password" : "new-password"}
                disabled={submitting}
                required
              />
              {(isRegister || isUpdatePassword) && (
                <p
                  className="text-[11px]"
                  style={{
                    color: "color-mix(in srgb, var(--muted) 75%, transparent)",
                  }}
                >
                  Usa al menos {PASSWORD_MIN_LENGTH} caracteres.
                </p>
              )}
            </div>
          )}

          {(isRegister || isUpdatePassword) && (
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Confirmar contrasena</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repite la contrasena"
                autoComplete="new-password"
                disabled={submitting}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ff-btn ff-btn-primary mt-2 w-full"
          >
            {submitting ? copy.loading : copy.button}
          </button>
        </form>

        <div className="mt-5 space-y-3 text-center text-xs text-[var(--muted)]">
          {isLogin && (
            <button
              onClick={() => switchMode(MODES.forgot)}
              type="button"
              disabled={submitting}
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--primary)" }}
            >
              Olvide mi contrasena
            </button>
          )}

          {isForgot && (
            <button
              onClick={() => switchMode(MODES.login)}
              type="button"
              disabled={submitting}
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--primary)" }}
            >
              Volver a iniciar sesion
            </button>
          )}

          {isUpdatePassword && (
            <button
              onClick={onCancelPasswordUpdate}
              type="button"
              disabled={submitting}
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--primary)" }}
            >
              Hacerlo mas tarde
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
