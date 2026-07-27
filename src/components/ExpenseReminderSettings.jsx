import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  disableExpenseReminder,
  enableExpenseReminder,
  getEngagementNotificationSettings,
  getExactAlarmPermissionValue,
  getExactAlarmPermissionStatus,
  getExpenseReminderSettings,
  openExactAlarmSettings,
  requestLocalNotificationPermissions,
  saveEngagementNotificationSettings,
} from "../lib/notifications/localNotifications";

function ReminderToggle({ checked, description, label, onChange }) {
  return (
    <label className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-sm font-semibold text-[var(--text)]">
          {label}
        </span>
        <span className="block text-xs text-[var(--muted)]">
          {description}
        </span>
      </span>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 self-start rounded-full transition-colors sm:mt-1 sm:self-auto ${
          checked ? "bg-[var(--primary)]" : "bg-[var(--panel-2)]"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
            checked ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

function ExpenseReminderSettings() {
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const isAndroid = Capacitor.getPlatform() === "android";
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("20:00");
  const [expenseAlerts, setExpenseAlerts] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(false);
  const [achievementAlerts, setAchievementAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [exactAlarmStatus, setExactAlarmStatus] = useState("granted");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [settings, engagementSettings, exactAlarmPermission] =
          await Promise.all([
          getExpenseReminderSettings(),
          getEngagementNotificationSettings(),
          isAndroid
            ? getExactAlarmPermissionStatus()
            : Promise.resolve({ display: "granted" }),
        ]);

        if (cancelled) {
          return;
        }

        setEnabled(settings.enabled);
        setTime(
          `${String(settings.hour).padStart(2, "0")}:${String(
            settings.minute
          ).padStart(2, "0")}`
        );
        setExpenseAlerts(engagementSettings.expenseAlerts);
        setBudgetAlerts(engagementSettings.budgetAlerts);
        setAchievementAlerts(engagementSettings.achievementAlerts);
        setExactAlarmStatus(getExactAlarmPermissionValue(exactAlarmPermission));
      } catch {
        if (!cancelled) {
          setMessage("No se pudieron cargar los recordatorios.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    if (!isAndroid) {
      return () => {
        cancelled = true;
      };
    }

    const refreshExactAlarmPermission = async () => {
      const status = await getExactAlarmPermissionStatus().catch(() => null);

      if (!status || cancelled) {
        return;
      }

      setExactAlarmStatus(getExactAlarmPermissionValue(status));
    };

    window.addEventListener("focus", refreshExactAlarmPermission);
    document.addEventListener("visibilitychange", refreshExactAlarmPermission);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshExactAlarmPermission);
      document.removeEventListener(
        "visibilitychange",
        refreshExactAlarmPermission
      );
    };
  }, [isAndroid]);

  const exactAlarmsGranted = exactAlarmStatus === "granted";

  const handleSave = async () => {
    if (!isNativeMobile) {
      setMessage("Los recordatorios locales solo funcionan en Android o iOS.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const engagementSettings = {
        expenseAlerts,
        budgetAlerts,
        achievementAlerts,
      };
      const hasEngagementAlerts =
        expenseAlerts || budgetAlerts || achievementAlerts;

      if (hasEngagementAlerts) {
        const permissions = await requestLocalNotificationPermissions();

        if (permissions.display !== "granted") {
          throw new Error("No se otorgaron permisos para notificaciones locales.");
        }
      }

      await saveEngagementNotificationSettings(engagementSettings);

      let dailyMessage = "Recordatorio diario desactivado.";

      if (!enabled) {
        await disableExpenseReminder();
      } else {
        const [hourText, minuteText] = time.split(":");
        const hour = Number(hourText);
        const minute = Number(minuteText);

        if (isAndroid) {
          const exactAlarmPermission = await getExactAlarmPermissionStatus();
          const nextStatus = getExactAlarmPermissionValue(exactAlarmPermission);
          setExactAlarmStatus(nextStatus);

          if (nextStatus !== "granted") {
            setMessage(
              "Android no tiene permiso para alarmas exactas. Abre la configuracion y habilitalas para evitar recordatorios fuera de hora."
            );
            await openExactAlarmSettings();
            return;
          }
        }

        await enableExpenseReminder({ hour, minute });
        dailyMessage = `Recordatorio diario activado a las ${time}.`;
      }

      setMessage(
        `${dailyMessage} ${
          hasEngagementAlerts
            ? "Alertas inteligentes activadas."
            : "Alertas inteligentes desactivadas."
        }`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando configuracion...</p>
      ) : (
        <>
          <ReminderToggle
            checked={enabled}
            description="Recibir una notificacion cada dia para registrar gastos."
            label="Recordatorio diario"
            onChange={setEnabled}
          />

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">
              Hora del recordatorio
            </span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={!enabled}
              className="ff-input"
            />
          </label>

          <div
            className="space-y-4 rounded-lg border p-4"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Alertas inteligentes
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Avisos breves cuando hay gastos, presupuestos o logros que
                merecen atencion.
              </p>
            </div>

            <ReminderToggle
              checked={expenseAlerts}
              description="Gasto diario alto, categorias fuera de ritmo o varios dias sin registrar."
              label="Ritmo de gastos"
              onChange={setExpenseAlerts}
            />

            <ReminderToggle
              checked={budgetAlerts}
              description="Limites, proyeccion de cierre de mes y disponible bajo."
              label="Presupuestos en foco"
              onChange={setBudgetAlerts}
            />

            <ReminderToggle
              checked={achievementAlerts}
              description="Metas cumplidas, rachas e insignias nuevas."
              label="Logros e insignias"
              onChange={setAchievementAlerts}
            />
          </div>

          {isAndroid && !exactAlarmsGranted && (
            <div
              className="rounded-xl border px-4 py-3 text-sm text-[var(--text)]"
              style={{
                borderColor: "var(--border-rgba)",
                background:
                  "color-mix(in srgb, var(--warning) 10%, var(--panel))",
              }}
            >
              <p>
                Android puede retrasar este recordatorio si las alarmas exactas
                no estan permitidas.
              </p>
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={async () => {
                    setMessage("");
                    await openExactAlarmSettings();
                  }}
                  className="ff-btn"
                >
                  Permitir alarmas exactas
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="ff-btn ff-btn-primary"
            >
              {saving ? "Guardando..." : "Guardar alertas"}
            </button>
          </div>

          {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
        </>
      )}
    </div>
  );
}

export default ExpenseReminderSettings;
