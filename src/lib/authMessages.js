export const PASSWORD_MIN_LENGTH = 6;

const cleanText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const errorText = (error) =>
  [
    error?.code,
    error?.name,
    error?.status,
    error?.message,
    error?.error,
    error?.errorCode,
    error?.errorDescription,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

export function getAuthErrorMessage(error, context = "default") {
  const text = errorText(error);

  if (
    text.includes("invalid login credentials") ||
    text.includes("invalid_credentials")
  ) {
    return "No pudimos iniciar sesion. El correo o la contrasena no coinciden.";
  }

  if (
    text.includes("email not confirmed") ||
    text.includes("email_not_confirmed")
  ) {
    return "Tu cuenta todavia no esta confirmada. Abre el correo de confirmacion y vuelve a iniciar sesion.";
  }

  if (
    text.includes("already registered") ||
    text.includes("user_already_exists") ||
    text.includes("already been registered")
  ) {
    return "Ya existe una cuenta con ese correo. Inicia sesion o usa recuperar contrasena.";
  }

  if (
    text.includes("invalid email") ||
    text.includes("email address is invalid") ||
    text.includes("unable to validate email")
  ) {
    return "El correo no parece valido. Revisa que este bien escrito.";
  }

  if (
    text.includes("password") &&
    (text.includes("weak") ||
      text.includes("short") ||
      text.includes("at least") ||
      text.includes("minimum") ||
      text.includes("minimo"))
  ) {
    return `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (
    text.includes("same password") ||
    text.includes("different from the old password")
  ) {
    return "La nueva contrasena debe ser diferente a la actual.";
  }

  if (
    text.includes("rate limit") ||
    text.includes("security purposes") ||
    text.includes("too many requests")
  ) {
    return "Se hicieron demasiados intentos seguidos. Espera unos minutos y prueba de nuevo.";
  }

  if (
    text.includes("token") &&
    (text.includes("expired") ||
      text.includes("invalid") ||
      text.includes("otp_expired"))
  ) {
    return "El enlace ya expiro o no es valido. Solicita uno nuevo desde la pantalla de acceso.";
  }

  if (
    text.includes("network") ||
    text.includes("failed to fetch") ||
    text.includes("fetch")
  ) {
    return "No pudimos conectar con el servicio de autenticacion. Revisa tu conexion e intenta otra vez.";
  }

  if (context === "register") {
    return "No pudimos crear la cuenta. Revisa el correo, la contrasena y vuelve a intentarlo.";
  }

  if (context === "reset") {
    return "No pudimos enviar el enlace de recuperacion. Revisa el correo e intenta otra vez.";
  }

  if (context === "updatePassword") {
    return "No pudimos actualizar la contrasena. Solicita un nuevo enlace o intenta otra vez.";
  }

  if (context === "changePassword") {
    return "No pudimos cambiar la contrasena. Revisa los datos e intenta otra vez.";
  }

  return "Algo no salio bien con la autenticacion. Intenta otra vez.";
}

export function getAuthUrlErrorMessage(authUrlState) {
  return getAuthErrorMessage(
    {
      code: authUrlState?.errorCode,
      error: authUrlState?.error,
      errorDescription: authUrlState?.errorDescription,
      message: authUrlState?.errorDescription,
    },
    "updatePassword"
  );
}
