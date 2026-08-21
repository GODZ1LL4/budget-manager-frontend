import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { HiRefresh } from "react-icons/hi";
import { withUserTimeZone } from "../../lib/dates/localDate";

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(safeNumber(value));

const formatSignedCurrency = (value) => {
  const number = safeNumber(value);
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(number))}`;
};

const formatPercent = (value) => `${safeNumber(value).toFixed(1)}%`;

function formatDate(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-");
  if (!year || !month || !day) return "Sin fecha";
  return `${day}/${month}/${year}`;
}

function formatDuration(days) {
  if (days == null) return "Sin ritmo";

  const safeDays = Math.max(0, Number(days) || 0);
  if (safeDays === 0) return "Hoy";
  if (safeDays === 1) return "1 dia";
  if (safeDays < 31) return `${safeDays} dias`;

  const months = safeDays / 30.4375;
  if (safeDays < 365) {
    return `${months.toFixed(months < 3 ? 1 : 0)} meses`;
  }

  const years = safeDays / 365.25;
  return `${years.toFixed(1)} anos`;
}

function statusConfig(status) {
  switch (status) {
    case "achieved":
      return { label: "Objetivo alcanzado", tone: "success" };
    case "on_track":
      return { label: "Llega a tiempo", tone: "success" };
    case "behind":
      return { label: "Fuera de plazo", tone: "danger" };
    case "overdue":
      return { label: "Fecha vencida", tone: "danger" };
    case "no_pace":
      return { label: "Sin ritmo suficiente", tone: "warning" };
    case "projected":
      return { label: "Proyectada", tone: "primary" };
    default:
      return { label: "Sin fecha limite", tone: "muted" };
  }
}

function confidenceLabel(value) {
  switch (value) {
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    case "low":
      return "Inicial";
    default:
      return "Sin datos";
  }
}

function velocitySourceLabel(source, recentDays) {
  if (source === "recent") return `Ultimos ${recentDays} dias`;
  if (source === "lifetime") return "Historico de la meta";
  return "Sin aportes";
}

function toneStyles(tone) {
  const map = {
    success: {
      color: "color-mix(in srgb, var(--success) 88%, var(--text))",
      borderColor: "color-mix(in srgb, var(--success) 38%, transparent)",
      background: "color-mix(in srgb, var(--success) 12%, transparent)",
    },
    danger: {
      color: "color-mix(in srgb, var(--danger) 88%, var(--text))",
      borderColor: "color-mix(in srgb, var(--danger) 38%, transparent)",
      background: "color-mix(in srgb, var(--danger) 12%, transparent)",
    },
    warning: {
      color: "color-mix(in srgb, var(--warning) 88%, var(--text))",
      borderColor: "color-mix(in srgb, var(--warning) 42%, transparent)",
      background: "color-mix(in srgb, var(--warning) 14%, transparent)",
    },
    primary: {
      color: "color-mix(in srgb, var(--primary) 85%, var(--text))",
      borderColor: "color-mix(in srgb, var(--primary) 34%, transparent)",
      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
    },
    muted: {
      color: "color-mix(in srgb, var(--text) 72%, transparent)",
      borderColor: "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
      background: "color-mix(in srgb, var(--panel) 55%, transparent)",
    },
  };

  return map[tone] || map.muted;
}

function TonePill({ children, tone = "muted" }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={toneStyles(tone)}
    >
      {children}
    </span>
  );
}

function SummaryCard({ label, value, helper, tone = "muted" }) {
  return (
    <div
      className="rounded-xl border p-4 min-h-[112px]"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 52%, transparent)",
      }}
    >
      <div
        className="text-xs font-semibold"
        style={{ color: "color-mix(in srgb, var(--text) 70%, transparent)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-xl font-extrabold break-words"
        style={{ color: toneStyles(tone).color }}
      >
        {value}
      </div>
      {helper ? (
        <div
          className="mt-1 text-xs"
          style={{ color: "color-mix(in srgb, var(--text) 62%, transparent)" }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value, tone = "muted" }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 min-h-[70px]"
      style={{
        borderColor: "color-mix(in srgb, var(--border-rgba) 72%, transparent)",
        background: "color-mix(in srgb, var(--bg-3) 45%, transparent)",
      }}
    >
      <div
        className="text-[11px] font-semibold"
        style={{ color: "color-mix(in srgb, var(--text) 64%, transparent)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-sm font-extrabold break-words"
        style={{ color: toneStyles(tone).color }}
      >
        {value}
      </div>
    </div>
  );
}

function buildNarrative(goal) {
  const status = goal.projection_status;

  if (status === "achieved") {
    return "Esta meta ya cubre el monto objetivo con el saldo reservado actual.";
  }

  if (status === "no_pace") {
    return "Aun no hay aportes netos suficientes para estimar una fecha de cumplimiento.";
  }

  if (status === "overdue") {
    return `La fecha limite vencio hace ${formatDuration(
      Math.abs(goal.days_until_due)
    )}; faltan ${formatCurrency(goal.remaining_amount)}.`;
  }

  if (goal.due_date && goal.can_meet_deadline === true) {
    const days = Math.max(0, safeNumber(goal.deadline_gap_days));
    const suffix =
      days > 0
        ? `${formatDuration(days)} antes de la fecha limite`
        : "en la fecha limite";
    return `Con el ritmo actual se logra ${suffix}.`;
  }

  if (goal.due_date && goal.can_meet_deadline === false) {
    const gap = Math.abs(safeNumber(goal.deadline_gap_amount));
    return `Con el ritmo actual faltarian ${formatCurrency(
      gap
    )} al llegar a la fecha limite.`;
  }

  return `Al ritmo actual se estima completar en ${formatDuration(
    goal.projected_completion_days
  )}.`;
}

function GoalRow({ goal, recentDays }) {
  const status = statusConfig(goal.projection_status);
  const progress = Math.max(0, Math.min(100, safeNumber(goal.progress_pct)));
  const gapAmount = safeNumber(goal.deadline_gap_amount);
  const gapTone =
    goal.deadline_gap_amount == null ? "muted" : gapAmount >= 0 ? "success" : "danger";
  const dueTone =
    goal.can_meet_deadline == null
      ? "muted"
      : goal.can_meet_deadline
      ? "success"
      : "danger";

  return (
    <div
      className="rounded-2xl border p-4 space-y-4"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--panel) 72%, transparent), color-mix(in srgb, var(--bg-2) 82%, transparent))",
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base md:text-lg font-extrabold text-[var(--text)] break-words">
              {goal.name}
            </h4>
            {goal.is_priority ? <TonePill tone="warning">Prioritaria</TonePill> : null}
            {goal.status === "paused" ? <TonePill>En pausa</TonePill> : null}
          </div>
          <p
            className="mt-1 text-sm"
            style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}
          >
            {buildNarrative(goal)}
          </p>
        </div>

        <TonePill tone={status.tone}>{status.label}</TonePill>
      </div>

      <div>
        <div className="mb-1 flex justify-between gap-3 text-xs font-semibold">
          <span style={{ color: "color-mix(in srgb, var(--text) 68%, transparent)" }}>
            {formatCurrency(goal.reserved_amount)} de{" "}
            {formatCurrency(goal.target_amount)}
          </span>
          <span style={{ color: "var(--text)" }}>{formatPercent(progress)}</span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full border"
          style={{
            borderColor: "color-mix(in srgb, var(--border-rgba) 72%, transparent)",
            background: "color-mix(in srgb, var(--bg-3) 70%, transparent)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background:
                progress >= 100
                  ? "var(--success)"
                  : "linear-gradient(90deg, var(--primary), var(--success))",
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        <MiniMetric
          label="Cumplimiento estimado"
          value={
            goal.projected_completion_date
              ? formatDate(goal.projected_completion_date)
              : "Sin fecha"
          }
          tone={goal.projected_completion_date ? "primary" : "warning"}
        />
        <MiniMetric
          label="Tiempo estimado"
          value={formatDuration(goal.projected_completion_days)}
          tone={goal.projected_completion_days == null ? "warning" : "primary"}
        />
        <MiniMetric
          label="Fecha limite"
          value={
            goal.due_date
              ? `${formatDate(goal.due_date)} (${formatDuration(
                  Math.abs(safeNumber(goal.days_until_due))
                )})`
              : "Sin fecha limite"
          }
          tone={dueTone}
        />
        <MiniMetric
          label="Faltante"
          value={formatCurrency(goal.remaining_amount)}
          tone={goal.remaining_amount > 0 ? "warning" : "success"}
        />
        <MiniMetric
          label="Ritmo actual mensual"
          value={formatCurrency(goal.projected_monthly_rate)}
          tone={goal.projected_monthly_rate > 0 ? "success" : "warning"}
        />
        <MiniMetric
          label="Ritmo requerido mensual"
          value={
            goal.required_monthly_rate == null
              ? "Sin plazo"
              : formatCurrency(goal.required_monthly_rate)
          }
          tone={
            goal.required_monthly_rate == null
              ? "muted"
              : goal.can_meet_deadline
              ? "success"
              : "danger"
          }
        />
        <MiniMetric
          label="Brecha en fecha limite"
          value={
            goal.deadline_gap_amount == null
              ? "Sin plazo"
              : formatSignedCurrency(goal.deadline_gap_amount)
          }
          tone={gapTone}
        />
        <MiniMetric
          label="Base de calculo"
          value={velocitySourceLabel(goal.velocity_source, recentDays)}
          tone={goal.velocity_source === "none" ? "warning" : "muted"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <TonePill>{goal.movement_count} movimientos</TonePill>
        <TonePill>Confianza {confidenceLabel(goal.confidence)}</TonePill>
        {goal.last_movement_date ? (
          <TonePill>
            Ultimo movimiento {formatDate(goal.last_movement_date)}
          </TonePill>
        ) : null}
      </div>
    </div>
  );
}

function GoalSavingsProjectionReport({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await axios.get(
        `${api}/analytics/goals-savings-projection`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      setReport(res.data?.data || null);
    } catch (err) {
      console.error("Error al cargar proyeccion de metas:", err);
      setError(
        err.response?.data?.error ||
          "No se pudo calcular la proyeccion de metas."
      );
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goals = useMemo(
    () => (Array.isArray(report?.goals) ? report.goals : []),
    [report]
  );
  const summary = report?.summary || {};
  const recentDays = report?.meta?.recent_window_days || 90;

  const filterOptions = useMemo(() => {
    const riskStatuses = new Set(["behind", "overdue", "no_pace"]);
    return [
      { id: "all", label: "Todas", count: goals.length },
      {
        id: "deadline",
        label: "Con fecha",
        count: goals.filter((goal) => goal.due_date).length,
      },
      {
        id: "risk",
        label: "En riesgo",
        count: goals.filter((goal) => riskStatuses.has(goal.projection_status))
          .length,
      },
      {
        id: "on_track",
        label: "En fecha",
        count: goals.filter((goal) => goal.projection_status === "on_track")
          .length,
      },
      {
        id: "no_deadline",
        label: "Sin fecha",
        count: goals.filter((goal) => !goal.due_date).length,
      },
    ];
  }, [goals]);

  const filteredGoals = useMemo(() => {
    const riskStatuses = new Set(["behind", "overdue", "no_pace"]);

    if (filter === "deadline") return goals.filter((goal) => goal.due_date);
    if (filter === "risk") {
      return goals.filter((goal) => riskStatuses.has(goal.projection_status));
    }
    if (filter === "on_track") {
      return goals.filter((goal) => goal.projection_status === "on_track");
    }
    if (filter === "no_deadline") return goals.filter((goal) => !goal.due_date);
    return goals;
  }, [filter, goals]);

  const riskCount = safeNumber(summary.at_risk_deadline);
  const insightTone = riskCount > 0 ? "danger" : "success";
  const insightText =
    riskCount > 0
      ? `${riskCount} meta${riskCount === 1 ? "" : "s"} con fecha limite necesita${
          riskCount === 1 ? "" : "n"
        } mas ritmo de ahorro.`
      : "Las metas con fecha limite estan dentro del ritmo esperado.";

  return (
    <div
      className="rounded-2xl p-6 space-y-5 overflow-hidden border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom right, var(--bg-1), color-mix(in srgb, var(--panel) 45%, transparent), var(--bg-1))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl md:text-2xl font-extrabold text-[var(--text)]">
            Proyeccion de cumplimiento de metas de ahorro
          </h3>
          <p
            className="text-sm mt-1 max-w-4xl"
            style={{ color: "color-mix(in srgb, var(--text) 74%, transparent)" }}
          >
            Estima cuando se completa cada meta, si llega dentro de su fecha
            limite y que ritmo mensual hace falta para cumplirla.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="ff-btn ff-btn-primary inline-flex items-center gap-2 self-start disabled:opacity-60"
        >
          <HiRefresh className={loading ? "animate-spin" : ""} />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error ? (
        <div
          className="rounded-xl border p-3 text-sm"
          style={toneStyles("danger")}
        >
          {error}
        </div>
      ) : null}

      {!report && loading ? (
        <p
          className="text-sm italic"
          style={{ color: "color-mix(in srgb, var(--text) 64%, transparent)" }}
        >
          Calculando cumplimiento de metas...
        </p>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              label="Progreso total"
              value={formatPercent(summary.progress_pct)}
              helper={`${formatCurrency(summary.reserved_total)} reservados`}
              tone="success"
            />
            <SummaryCard
              label="Faltante total"
              value={formatCurrency(summary.remaining_total)}
              helper={`${safeNumber(summary.goals_count)} metas activas o pausadas`}
              tone={summary.remaining_total > 0 ? "warning" : "success"}
            />
            <SummaryCard
              label="Ritmo mensual proyectado"
              value={formatCurrency(summary.projected_monthly_rate_total)}
              helper="Base reciente cuando existe"
              tone={summary.projected_monthly_rate_total > 0 ? "primary" : "warning"}
            />
            <SummaryCard
              label="Fechas limite"
              value={`${safeNumber(summary.on_track_deadline)} / ${safeNumber(
                summary.goals_with_deadline
              )}`}
              helper="Metas que llegan a tiempo"
              tone={riskCount > 0 ? "danger" : "success"}
            />
          </div>

          {goals.length > 0 ? (
            <div
              className="rounded-xl border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              style={{
                borderColor: toneStyles(insightTone).borderColor,
                background: toneStyles(insightTone).background,
                color: toneStyles(insightTone).color,
              }}
            >
              <div className="text-sm font-bold">{insightText}</div>
              <div className="text-xs font-semibold">
                Corte: {formatDate(report.meta?.today)}
              </div>
            </div>
          ) : null}

          {goals.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    aria-pressed={active}
                    className="rounded-full border px-3 py-1.5 text-sm font-bold transition"
                    style={
                      active
                        ? toneStyles("primary")
                        : {
                            color:
                              "color-mix(in srgb, var(--text) 74%, transparent)",
                            borderColor:
                              "color-mix(in srgb, var(--border-rgba) 70%, transparent)",
                            background:
                              "color-mix(in srgb, var(--panel) 45%, transparent)",
                          }
                    }
                  >
                    {option.label} ({option.count})
                  </button>
                );
              })}
            </div>
          ) : null}

          {goals.length === 0 ? (
            <p
              className="text-sm italic"
              style={{ color: "color-mix(in srgb, var(--text) 64%, transparent)" }}
            >
              No hay metas activas o pausadas para proyectar.
            </p>
          ) : filteredGoals.length === 0 ? (
            <p
              className="text-sm italic"
              style={{ color: "color-mix(in srgb, var(--text) 64%, transparent)" }}
            >
              No hay metas en este filtro.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredGoals.map((goal) => (
                <GoalRow key={goal.id} goal={goal} recentDays={recentDays} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default GoalSavingsProjectionReport;
