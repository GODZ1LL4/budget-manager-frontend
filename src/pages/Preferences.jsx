import { createElement, useEffect, useMemo, useState } from "react";
import { HiBell, HiChevronDown, HiGlobeAlt, HiKey, HiSparkles } from "react-icons/hi";
import { toast } from "react-toastify";
import FFSelect from "../components/FFSelect";
import ExpenseReminderSettings from "../components/ExpenseReminderSettings";
import PremiumAccessSection from "../components/PremiumAccessSection";
import PasswordChangeSection from "../components/PasswordChangeSection";
import { useAppPreferences } from "../context/AppPreferencesContext";
import { clearToastBacklog } from "../lib/notifications/toastGuard";
import { SUBSCRIPTION_MODES } from "../lib/subscription/subscriptionAccess";

function PreferenceSection({
  children,
  description,
  icon,
  isOpen,
  onToggle,
  summary,
  title,
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 84%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--panel-2)_62%,transparent)]"
        aria-expanded={isOpen}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 28%, var(--border-rgba))",
            background: "color-mix(in srgb, var(--primary) 10%, var(--panel))",
            color: "var(--primary)",
          }}
        >
          {createElement(icon, {
            className: "h-5 w-5",
            "aria-hidden": "true",
          })}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--text)]">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
            {isOpen ? description : summary}
          </span>
        </span>

        <HiChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border-rgba)" }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function Preferences({ token, subscriptionMode, onSubscriptionModeChange }) {
  const { preferences, setPreferences } = useAppPreferences();
  const [currency, setCurrency] = useState("DOP");
  const [locale, setLocale] = useState("es-DO");
  const [showToasts, setShowToasts] = useState(true);
  const [openSection, setOpenSection] = useState("general");

  useEffect(() => {
    setCurrency(preferences.currency);
    setLocale(preferences.locale);
    setShowToasts(preferences.showToasts !== false);
  }, [preferences]);

  const currencyOptions = useMemo(
    () => [
      { value: "DOP", label: "Peso dominicano (DOP)" },
      { value: "USD", label: "Dolar estadounidense (USD)" },
      { value: "EUR", label: "Euro (EUR)" },
      { value: "MXN", label: "Peso mexicano (MXN)" },
      { value: "COP", label: "Peso colombiano (COP)" },
    ],
    []
  );

  const localeOptions = useMemo(
    () => [
      { value: "es-DO", label: "Espanol (Republica Dominicana)" },
      { value: "es-ES", label: "Espanol (Espana)" },
      { value: "en-US", label: "English (United States)" },
    ],
    []
  );

  const localeLabel =
    localeOptions.find((option) => option.value === locale)?.label || locale;
  const premiumSummary =
    subscriptionMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE
      ? "Premium activo"
      : "Sin Premium activo";

  const handleSave = () => {
    setPreferences({
      currency,
      locale,
      showToasts,
    });

    if (showToasts) {
      toast.success("Preferencias guardadas");
    } else {
      clearToastBacklog();
    }
  };

  const toggleSection = (section) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="space-y-1">
        <h2 className="ff-h2">
          <span className="ff-heading-accent">Preferencias</span>
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Ajustes de cuenta, experiencia y acceso.
        </p>
      </div>

      <div className="space-y-3">
        <PreferenceSection
          title="General"
          description="Moneda, idioma y avisos emergentes."
          summary={`${currency} · ${localeLabel} · Avisos ${
            showToasts ? "activos" : "ocultos"
          }`}
          icon={HiGlobeAlt}
          isOpen={openSection === "general"}
          onToggle={() => toggleSection("general")}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col space-y-1">
                <label className="ff-label">Moneda</label>
                <FFSelect
                  value={currency}
                  onChange={(value) => setCurrency(value)}
                  options={currencyOptions}
                  clearable={false}
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="ff-label">Idioma</label>
                <FFSelect
                  value={locale}
                  onChange={(value) => setLocale(value)}
                  options={localeOptions}
                  clearable={false}
                />
              </div>
            </div>

            <label className="flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              }}
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  Mostrar avisos emergentes
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {showToasts ? "Activos" : "Ocultos"}
                </span>
              </span>

              <button
                type="button"
                onClick={() => setShowToasts((prev) => !prev)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  showToasts ? "bg-[var(--primary)]" : "bg-[var(--panel-2)]"
                }`}
                aria-pressed={showToasts}
                aria-label="Cambiar avisos emergentes"
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
                    showToasts ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                className="ff-btn ff-btn-primary"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        </PreferenceSection>

        <PreferenceSection
          title="Recordatorios"
          description="Avisos locales para gastos y tareas frecuentes."
          summary="Avisos locales"
          icon={HiBell}
          isOpen={openSection === "reminders"}
          onToggle={() => toggleSection("reminders")}
        >
          <ExpenseReminderSettings />
        </PreferenceSection>

        <PreferenceSection
          title="Seguridad"
          description="Contrasena y acceso de la cuenta."
          summary="Cambiar contrasena"
          icon={HiKey}
          isOpen={openSection === "security"}
          onToggle={() => toggleSection("security")}
        >
          <PasswordChangeSection compact />
        </PreferenceSection>

        <PreferenceSection
          title="Premium"
          description="Acceso Premium administrado por Google Play."
          summary={premiumSummary}
          icon={HiSparkles}
          isOpen={openSection === "premium"}
          onToggle={() => toggleSection("premium")}
        >
          <PremiumAccessSection
            token={token}
            subscriptionMode={subscriptionMode}
            onSubscriptionModeChange={onSubscriptionModeChange}
            compact
          />
        </PreferenceSection>
      </div>
    </div>
  );
}

export default Preferences;
