import { useState } from "react";
import { toast } from "react-toastify";
import supabase from "../lib/supabase";
import {
  getAuthErrorMessage,
  PASSWORD_MIN_LENGTH,
} from "../lib/authMessages";
import PasswordInput from "./PasswordInput";

function PasswordChangeSection({ compact = false }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const showNotice = (type, message) => {
    setNotice({ type, message });

    if (type === "success") {
      toast.success(message);
      return;
    }

    toast.error(message);
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotice("error", "Completa la contrasena actual, la nueva y la confirmacion.");
      return;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      showNotice(
        "error",
        `La nueva contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotice("error", "La nueva contrasena y la confirmacion no coinciden.");
      return;
    }

    if (currentPassword === newPassword) {
      showNotice("error", "La nueva contrasena debe ser diferente a la actual.");
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const email = userData?.user?.email;

      if (!email) {
        throw new Error("No se pudo identificar el correo de la cuenta.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        showNotice(
          "error",
          "La contrasena actual no coincide con esta cuenta."
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        showNotice(
          "error",
          getAuthErrorMessage(updateError, "changePassword")
        );
        return;
      }

      resetForm();
      showNotice("success", "Contrasena actualizada correctamente.");
    } catch (error) {
      showNotice("error", getAuthErrorMessage(error, "changePassword"));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]">
            Seguridad de la cuenta
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Cambia la contrasena usando la contrasena actual.
          </p>
        </div>
      )}

      {notice && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor:
              notice.type === "success"
                ? "color-mix(in srgb, var(--success) 38%, var(--border-rgba))"
                : "color-mix(in srgb, var(--danger) 38%, var(--border-rgba))",
            background:
              notice.type === "success"
                ? "color-mix(in srgb, var(--success) 12%, var(--panel))"
                : "color-mix(in srgb, var(--danger) 12%, var(--panel))",
            color: "var(--text)",
          }}
        >
          {notice.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Contrasena actual</label>
          <PasswordInput
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            disabled={saving}
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">Nueva contrasena</label>
          <PasswordInput
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            disabled={saving}
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">Confirmar nueva contrasena</label>
          <PasswordInput
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            disabled={saving}
          />
        </div>

        <div className="md:col-span-3 flex justify-center">
          <button type="submit" className="ff-btn ff-btn-primary" disabled={saving}>
            {saving ? "Actualizando..." : "Cambiar contrasena"}
          </button>
        </div>
      </form>
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <section className="ff-surface p-4 space-y-4">
      {content}
    </section>
  );
}

export default PasswordChangeSection;
