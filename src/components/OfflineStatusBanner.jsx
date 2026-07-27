function OfflineStatusBanner({ isOnline }) {
  return (
    <div
      className="px-4 py-2 text-sm font-medium text-center"
      style={{
        background: isOnline
          ? "color-mix(in srgb, var(--success) 16%, var(--panel))"
          : "color-mix(in srgb, var(--warning, #d97706) 18%, var(--panel))",
        borderBottom: "var(--border-w) solid",
        borderColor: isOnline
          ? "color-mix(in srgb, var(--success) 35%, var(--border-rgba))"
          : "color-mix(in srgb, var(--warning, #d97706) 35%, var(--border-rgba))",
        color: "var(--text)",
      }}
    >
      {isOnline
        ? "Conexion disponible. La app puede sincronizar cambios pendientes."
        : "Sin conexion. Tus cambios se guardaran localmente en este dispositivo."}
    </div>
  );
}

export default OfflineStatusBanner;
