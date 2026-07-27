import { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import axios from "axios";
import {
  HiArrowRight,
  HiChartBar,
  HiExclamationCircle,
  HiRefresh,
  HiShieldCheck,
  HiTrendingDown,
  HiTrendingUp,
} from "react-icons/hi";
import { useAppPreferences } from "../context/AppPreferencesContext";
import {
  lastDayOfMonthDateKey,
  todayDateKey,
  withUserTimeZone,
} from "../lib/dates/localDate";
import { SUBSCRIPTION_MODES } from "../lib/subscription/subscriptionAccess";

const tabOptions = [
  { id: "overview", label: "Mes" },
  { id: "year", label: "Año" },
  { id: "budget", label: "Presupuesto" },
  { id: "alerts", label: "Alertas" },
];

const PARAM_STORAGE_KEY = "mobile_reports:projection_params";

function getCurrentReportYear() {
  const year = Number(todayDateKey().slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

const DEFAULT_REPORT_PARAMS = {
  year: getCurrentReportYear(),
  months: 12,
  minOccurrences: 3,
  includeOccasional: false,
  includeNoise: true,
  minIntervalDays: 3,
  maxIntervalDays: 70,
  maxCoefVariation: 0.6,
};

function clampNumber(value, min, max, fallback) {
  const normalized =
    typeof value === "string" ? value.trim().replace(",", ".") : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function sanitizeReportParams(raw = {}) {
  const currentYear = getCurrentReportYear();
  const minIntervalDays = clampNumber(
    raw.minIntervalDays,
    1,
    365,
    DEFAULT_REPORT_PARAMS.minIntervalDays
  );

  return {
    year: clampNumber(raw.year, 2000, currentYear + 1, currentYear),
    months: clampNumber(raw.months, 1, 36, DEFAULT_REPORT_PARAMS.months),
    minOccurrences: clampNumber(
      raw.minOccurrences,
      2,
      50,
      DEFAULT_REPORT_PARAMS.minOccurrences
    ),
    includeOccasional:
      typeof raw.includeOccasional === "boolean"
        ? raw.includeOccasional
        : DEFAULT_REPORT_PARAMS.includeOccasional,
    includeNoise:
      typeof raw.includeNoise === "boolean"
        ? raw.includeNoise
        : DEFAULT_REPORT_PARAMS.includeNoise,
    minIntervalDays,
    maxIntervalDays: clampNumber(
      raw.maxIntervalDays,
      minIntervalDays,
      3650,
      Math.max(DEFAULT_REPORT_PARAMS.maxIntervalDays, minIntervalDays)
    ),
    maxCoefVariation: clampNumber(
      raw.maxCoefVariation,
      0.05,
      2,
      DEFAULT_REPORT_PARAMS.maxCoefVariation
    ),
  };
}

function getInitialReportParams() {
  try {
    const saved = localStorage.getItem(PARAM_STORAGE_KEY);
    if (!saved) return DEFAULT_REPORT_PARAMS;
    return sanitizeReportParams(JSON.parse(saved));
  } catch {
    return DEFAULT_REPORT_PARAMS;
  }
}

function parseDraftNumber(value) {
  if (value == null || String(value).trim() === "") {
    return null;
  }

  const number = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function validateReportParams(raw = {}) {
  const currentYear = getCurrentReportYear();
  const errors = {};

  const integerFields = [
    ["year", "Año", 2000, currentYear + 1],
    ["months", "Historial", 1, 36],
    ["minOccurrences", "Ocurrencias", 2, 50],
    ["minIntervalDays", "Min dias", 1, 365],
    ["maxIntervalDays", "Max dias", 1, 3650],
  ];

  integerFields.forEach(([field, label, min, max]) => {
    const value = parseDraftNumber(raw[field]);

    if (value == null) {
      errors[field] = `${label} es obligatorio.`;
      return;
    }

    if (!Number.isInteger(value)) {
      errors[field] = `${label} debe ser un numero entero.`;
      return;
    }

    if (value < min || value > max) {
      errors[field] = `${label} debe estar entre ${min} y ${max}.`;
    }
  });

  const minIntervalDays = parseDraftNumber(raw.minIntervalDays);
  const maxIntervalDays = parseDraftNumber(raw.maxIntervalDays);
  if (
    !errors.minIntervalDays &&
    !errors.maxIntervalDays &&
    maxIntervalDays < minIntervalDays
  ) {
    errors.maxIntervalDays = "Max dias debe ser mayor o igual a Min dias.";
  }

  const maxCoefVariation = parseDraftNumber(raw.maxCoefVariation);
  if (maxCoefVariation == null) {
    errors.maxCoefVariation = "Coef variacion es obligatorio.";
  } else if (maxCoefVariation < 0.05 || maxCoefVariation > 2) {
    errors.maxCoefVariation = "Coef variacion debe estar entre 0.05 y 2.";
  }

  return errors;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toFixed(digits)}%`;
}

function buildAdvancedParams(params) {
  return {
    months: params.months,
    min_occurrences: params.minOccurrences,
    include_occasional: params.includeOccasional,
    include_noise: params.includeNoise,
    min_interval_days: params.minIntervalDays,
    max_interval_days: params.maxIntervalDays,
    max_coef_variation: params.maxCoefVariation,
  };
}

function toneColor(tone) {
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "var(--warning)";
  if (tone === "success") return "var(--success)";
  return "var(--primary)";
}

function toneBorder(tone) {
  const color = toneColor(tone);
  return `color-mix(in srgb, ${color} 42%, var(--border-rgba))`;
}

function Surface({ children, className = "" }) {
  return (
    <section
      className={`rounded-lg border p-4 ${className}`}
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 90%, transparent)",
      }}
    >
      {children}
    </section>
  );
}

function StatTile({ label, value, tone = "neutral", helper }) {
  const color = toneColor(tone);

  return (
    <div
      className="min-w-0 rounded-lg border p-3"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 78%, transparent)",
      }}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-2 min-w-0 text-base font-extrabold leading-tight [overflow-wrap:anywhere]"
        style={{ color }}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function ProgressLine({ value, max = 100, tone = "primary" }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const color = toneColor(tone);

  return (
    <div
      className="h-2.5 overflow-hidden rounded-full"
      style={{ background: "color-mix(in srgb, var(--panel) 58%, transparent)" }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
          background: color,
        }}
      />
    </div>
  );
}

function NumberControl({ label, value, step = 1, onChange, error }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type="text"
        inputMode={step === 1 ? "numeric" : "decimal"}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{
          borderColor: error
            ? "color-mix(in srgb, var(--danger) 55%, var(--border-rgba))"
            : "var(--border-rgba)",
          background: "var(--control-bg)",
          color: "var(--control-text)",
        }}
      />
      {error ? (
        <span className="mt-1 block text-[11px] text-[var(--danger)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ToggleControl({ label, checked, onChange }) {
  return (
    <label
      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 76%, transparent)",
        color: "var(--text)",
      }}
    >
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    </label>
  );
}

function ParametersPanel({
  draftParams,
  appliedParams,
  onDraftChange,
  onApply,
  onReset,
}) {
  const errors = validateReportParams(draftParams);
  const hasErrors = Object.keys(errors).length > 0;
  const hasChanges =
    !hasErrors &&
    JSON.stringify(sanitizeReportParams(draftParams)) !==
    JSON.stringify(sanitizeReportParams(appliedParams));

  const setField = (field, value) => {
    onDraftChange((current) =>
      ({
        ...current,
        [field]: value,
      })
    );
  };

  return (
    <details
      className="rounded-lg border p-3"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 88%, transparent)",
      }}
    >
      <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--text)]">
        Parametros generales
      </summary>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <NumberControl
              label="Año"
              value={draftParams.year}
              min={2000}
              max={getCurrentReportYear() + 1}
              onChange={(value) => setField("year", value)}
              error={errors.year}
            />
          </div>
          <NumberControl
            label="Historial"
            value={draftParams.months}
            min={1}
            max={36}
            onChange={(value) => setField("months", value)}
            error={errors.months}
          />
          <NumberControl
            label="Ocurrencias"
            value={draftParams.minOccurrences}
            min={2}
            max={50}
            onChange={(value) => setField("minOccurrences", value)}
            error={errors.minOccurrences}
          />
          <NumberControl
            label="Min dias"
            value={draftParams.minIntervalDays}
            min={1}
            max={365}
            onChange={(value) => setField("minIntervalDays", value)}
            error={errors.minIntervalDays}
          />
          <NumberControl
            label="Max dias"
            value={draftParams.maxIntervalDays}
            min={draftParams.minIntervalDays}
            max={3650}
            onChange={(value) => setField("maxIntervalDays", value)}
            error={errors.maxIntervalDays}
          />
          <div className="col-span-2">
            <NumberControl
              label="Coef variacion"
              value={draftParams.maxCoefVariation}
              min={0.05}
              max={2}
              step={0.05}
              onChange={(value) => setField("maxCoefVariation", value)}
              error={errors.maxCoefVariation}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <ToggleControl
            label="Incluir ocasionales"
            checked={draftParams.includeOccasional}
            onChange={(checked) => setField("includeOccasional", checked)}
          />
          <ToggleControl
            label="Incluir eventos"
            checked={draftParams.includeNoise}
            onChange={(checked) => setField("includeNoise", checked)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border px-3 py-2 text-sm font-semibold text-[var(--text)]"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 76%, transparent)",
            }}
          >
            Restaurar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!hasChanges || hasErrors}
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))",
              background: "color-mix(in srgb, var(--primary) 18%, var(--panel))",
              color: "var(--text)",
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </details>
  );
}

function InsightCard({ insight, onNavigate, formatCurrency }) {
  const Icon =
    insight.tone === "danger"
      ? HiExclamationCircle
      : insight.tone === "success"
      ? HiShieldCheck
      : HiChartBar;

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: toneBorder(insight.tone),
        background: `color-mix(in srgb, ${toneColor(
          insight.tone
        )} 10%, var(--panel))`,
      }}
    >
      <div className="flex items-start gap-3">
        <Icon
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: toneColor(insight.tone) }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">
            {insight.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {insight.description(formatCurrency)}
          </p>
        </div>
      </div>
      {insight.view ? (
        <button
          type="button"
          onClick={() => onNavigate(insight.view)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
        >
          Ir <HiArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function DailyBars({ report, formatCurrency }) {
  const days = (report?.daily_series || [])
    .filter((row) => row.amount != null)
    .slice(-14);
  const maxAmount = Math.max(
    1,
    ...days.map((row) =>
      Math.max(numberValue(row.amount), numberValue(row.expected_budget))
    )
  );

  if (!days.length) {
    return (
      <p className="text-sm italic text-[var(--muted)]">
        Todavia no hay gasto diario este mes.
      </p>
    );
  }

  return (
    <div className="flex h-28 items-end gap-1.5">
      {days.map((row) => {
        const amount = numberValue(row.amount);
        const expected = numberValue(row.expected_budget);
        const isOver = expected > 0 && amount > expected;
        const height = Math.max(8, (amount / maxAmount) * 100);

        return (
          <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end">
              <div
                className="w-full rounded-t"
                title={`${row.date}: ${formatCurrency(amount)}`}
                style={{
                  height: `${height}%`,
                  background: isOver ? "var(--danger)" : "var(--primary)",
                  opacity: amount > 0 ? 1 : 0.32,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--muted)]">{row.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRows({
  rows,
  formatCurrency,
  emptyText,
  shareLabel = "del gasto",
}) {
  if (!rows?.length) {
    return <p className="text-sm italic text-[var(--muted)]">{emptyText}</p>;
  }

  const maxAmount = Math.max(1, ...rows.map((row) => numberValue(row.amount)));

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.category_id || row.category_name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-[var(--text)]">
              {row.category_name}
            </span>
            <span className="shrink-0 font-semibold text-[var(--text)]">
              {formatCurrency(row.amount)}
            </span>
          </div>
          <ProgressLine value={numberValue(row.amount)} max={maxAmount} />
          {row.share_pct != null ? (
            <p className="text-[11px] text-[var(--muted)]">
              {formatPercent(row.share_pct)} {shareLabel}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TransactionRows({ rows, formatCurrency, emptyText }) {
  if (!rows?.length) {
    return <p className="text-sm italic text-[var(--muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const isIncome = row.type === "income";

        return (
          <div
            key={row.id}
            className="rounded-lg border p-3"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 76%, transparent)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text)]">
                  {row.description}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {row.category_name} - {row.date}
                </p>
              </div>
              <span
                className="shrink-0 text-sm font-bold"
                style={{ color: isIncome ? "var(--success)" : "var(--danger)" }}
              >
                {isIncome ? "+" : "-"}
                {formatCurrency(row.amount)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthBars({ rows, formatCurrency }) {
  const months = rows || [];
  const maxAmount = Math.max(
    1,
    ...months.map((row) =>
      Math.max(numberValue(row.income), numberValue(row.expense))
    )
  );

  return (
    <div className="flex h-32 items-end gap-1.5">
      {months.map((row) => {
        const incomeHeight = Math.max(0, (numberValue(row.income) / maxAmount) * 100);
        const expenseHeight = Math.max(0, (numberValue(row.expense) / maxAmount) * 100);

        return (
          <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t"
                title={`${row.month} ingresos: ${formatCurrency(row.income)}`}
                style={{
                  height: `${Math.max(incomeHeight, row.income > 0 ? 5 : 0)}%`,
                  background: "var(--success)",
                  opacity: row.income > 0 ? 1 : 0.22,
                }}
              />
              <div
                className="w-1/2 rounded-t"
                title={`${row.month} gastos: ${formatCurrency(row.expense)}`}
                style={{
                  height: `${Math.max(expenseHeight, row.expense > 0 ? 5 : 0)}%`,
                  background: "var(--danger)",
                  opacity: row.expense > 0 ? 1 : 0.22,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--muted)]">
              {String(row.month || "").slice(5, 7)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BudgetRows({ rows, formatCurrency }) {
  if (!rows?.length) {
    return (
      <p className="text-sm italic text-[var(--muted)]">
        No hay presupuestos para este mes.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const tone =
          row.status === "over"
            ? "danger"
            : row.status === "risk"
            ? "warning"
            : "success";

        return (
          <div
            key={row.category_id}
            className="rounded-lg border p-3"
            style={{
              borderColor: toneBorder(tone),
              background: "color-mix(in srgb, var(--panel) 78%, transparent)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text)]">
                  {row.category_name}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatCurrency(row.spent)} de {formatCurrency(row.limit)}
                </p>
              </div>
              <span
                className="shrink-0 text-xs font-bold"
                style={{ color: toneColor(tone) }}
              >
                {formatPercent(row.used_pct, 0)}
              </span>
            </div>
            <div className="mt-3">
              <ProgressLine value={numberValue(row.spent)} max={numberValue(row.limit)} tone={tone} />
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              {row.over > 0
                ? `Exceso ${formatCurrency(row.over)}`
                : `Restante ${formatCurrency(row.remaining)}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ForecastRawRows({ rows, formatCurrency }) {
  if (!rows?.length) {
    return (
      <p className="text-sm italic text-[var(--muted)]">
        No hay patrones proyectados con estos parametros.
      </p>
    );
  }

  return (
    <details
      className="rounded-lg border p-3"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 78%, transparent)",
      }}
    >
      <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--text)]">
        Transacciones proy. ({rows.length})
      </summary>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {rows.map((row, index) => {
          const isIncome = row.tx_type === "income";
          const tone = isIncome ? "success" : "danger";

          return (
            <div
              key={`${row.pattern}-${index}`}
              className="rounded-lg border p-3"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 72%, transparent)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-[var(--text)]">
                    {row.pattern}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {row.type === "recurring" ? "Recurrente" : "Evento"} -{" "}
                    {row.expected_count || 0} mov.
                  </p>
                </div>
                <span
                  className="shrink-0 text-sm font-bold"
                  style={{ color: toneColor(tone) }}
                >
                  {formatCurrency(row.projection)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function buildInsights(report, projection) {
  if (!report) return [];

  const insights = [];
  const projectedOverBudget = numberValue(projection?.projectedOverBudget);
  const paceRatio =
    numberValue(projection?.expectedToDate) > 0
      ? (numberValue(projection?.actualToDate) /
          numberValue(projection?.expectedToDate)) *
        100
      : report.signals?.pace_ratio_pct;
  const withoutBudget = numberValue(report.budgets?.without_budget);
  const unusualCount = report.alerts?.unusual_expenses?.length || 0;
  const remainingDaily = numberValue(report.summary?.remaining_daily_allowance);
  const dailyAverage = numberValue(report.summary?.daily_average);

  if (projectedOverBudget > 0) {
    insights.push({
      tone: "danger",
      title: "Cierre por encima del presupuesto",
      view: "budgets",
      description: (formatCurrency) =>
        `La proyeccion supera el presupuesto por ${formatCurrency(
          projectedOverBudget
        )}.`,
    });
  } else if (numberValue(report.budgets?.budgeted) > 0) {
    insights.push({
      tone: "success",
      title: "Cierre dentro del presupuesto",
      view: "budgets",
      description: (formatCurrency) =>
        `El margen proyectado es ${formatCurrency(
          Math.abs(projectedOverBudget)
        )}.`,
    });
  }

  if (paceRatio != null && paceRatio > 115) {
    insights.push({
      tone: "warning",
      title: "Ritmo de gasto acelerado",
      view: "transactions",
      description: () =>
        `Vas al ${formatPercent(paceRatio, 0)} del ritmo esperado para la fecha.`,
    });
  }

  if (withoutBudget > 0) {
    insights.push({
      tone: "warning",
      title: "Gasto fuera de presupuesto",
      view: "budgets",
      description: (formatCurrency) =>
        `${formatCurrency(withoutBudget)} no esta cubierto por presupuestos.`,
    });
  }

  if (unusualCount > 0) {
    insights.push({
      tone: "danger",
      title: "Movimientos atipicos",
      view: "transactions",
      description: () =>
        `${unusualCount} gasto(s) estan por encima de tu patron historico.`,
    });
  }

  if (remainingDaily > 0 && dailyAverage > 0 && remainingDaily < dailyAverage * 0.7) {
    insights.push({
      tone: "warning",
      title: "Margen diario ajustado",
      view: "transactions",
      description: (formatCurrency) =>
        `Quedan ${formatCurrency(remainingDaily)} por dia para cerrar dentro del presupuesto.`,
    });
  }

  if (!insights.length) {
    insights.push({
      tone: "success",
      title: "Mes estable",
      description: () =>
        "No se detectan excesos, movimientos atipicos ni gasto fuera de presupuesto.",
    });
  }

  return insights.slice(0, 4);
}

function PremiumLocked({ setView }) {
  return (
    <Surface className="space-y-4">
      <div className="flex items-start gap-3">
        <HiShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Reportes Premium</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Esta pagina esta disponible para suscripciones Premium en mobile.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setView("preferences")}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-[var(--text)]"
        style={{
          borderColor: "var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 76%, transparent)",
        }}
      >
        Ver Premium <HiArrowRight className="h-4 w-4" />
      </button>
    </Surface>
  );
}

function MobileReports({ token, subscriptionMode, setView }) {
  const api = import.meta.env.VITE_API_URL;
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const { formatCurrency, formatMonthLabel } = useAppPreferences();
  const [activeTab, setActiveTab] = useState("overview");
  const [report, setReport] = useState(null);
  const [yearlyOverview, setYearlyOverview] = useState(null);
  const [advancedBurnRate, setAdvancedBurnRate] = useState(null);
  const [advancedForecast, setAdvancedForecast] = useState(null);
  const [reportParams, setReportParams] = useState(getInitialReportParams);
  const [draftParams, setDraftParams] = useState(getInitialReportParams);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectionError, setProjectionError] = useState("");

  const isPremiumActive = subscriptionMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE;

  const loadReport = useCallback(async () => {
    if (!token || !isPremiumActive) return;

    setLoading(true);
    setError("");
    setProjectionError("");

    try {
      const today = todayDateKey();
      const advancedParams = buildAdvancedParams(reportParams);
      const authHeaders = { Authorization: `Bearer ${token}` };
      const requestConfig = withUserTimeZone({
        headers: authHeaders,
      });

      const [baseResult, yearlyResult, burnResult, forecastResult] =
        await Promise.allSettled([
        axios.get(`${api}/analytics/mobile-monthly-report`, requestConfig),
        axios.get(
          `${api}/analytics/mobile-yearly-overview`,
          withUserTimeZone({
            headers: authHeaders,
            params: { year: reportParams.year },
          })
        ),
        axios.get(
          `${api}/analytics/advanced-burn-rate-current-month`,
          withUserTimeZone({
            headers: authHeaders,
            params: advancedParams,
          })
        ),
        axios.get(
          `${api}/analytics/expense-forecast`,
          withUserTimeZone({
            headers: authHeaders,
            params: {
              ...advancedParams,
              date_from: today,
              date_to: lastDayOfMonthDateKey(today),
              types: "expense,income",
              include_balance: true,
              raw: 1,
            },
          })
        ),
      ]);

      if (baseResult.status !== "fulfilled") {
        const err = baseResult.reason;
        throw err;
      }

      setReport(baseResult.value.data?.data || null);
      setYearlyOverview(
        yearlyResult.status === "fulfilled"
          ? yearlyResult.value.data?.data || null
          : null
      );
      setAdvancedBurnRate(
        burnResult.status === "fulfilled"
          ? burnResult.value.data?.data || null
          : null
      );
      setAdvancedForecast(
        forecastResult.status === "fulfilled"
          ? forecastResult.value.data || null
          : null
      );

      if (
        yearlyResult.status !== "fulfilled" ||
        burnResult.status !== "fulfilled" ||
        forecastResult.status !== "fulfilled"
      ) {
        setProjectionError("Algunas secciones avanzadas no se pudieron calcular.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "No se pudieron cargar los reportes."
      );
      setReport(null);
      setYearlyOverview(null);
      setAdvancedBurnRate(null);
      setAdvancedForecast(null);
    } finally {
      setLoading(false);
    }
  }, [api, isPremiumActive, reportParams, token]);

  useEffect(() => {
    try {
      localStorage.setItem(PARAM_STORAGE_KEY, JSON.stringify(reportParams));
    } catch {
      return;
    }
  }, [reportParams]);

  const projection = useMemo(() => {
    const budgeted = numberValue(report?.budgets?.budgeted);
    const projectedExpense =
      advancedBurnRate?.projected_end_of_month != null
        ? numberValue(advancedBurnRate.projected_end_of_month)
        : numberValue(report?.summary?.projected_expense);
    const projectedOverBudget =
      budgeted > 0 ? projectedExpense - budgeted : 0;
    const forecastSummary = advancedForecast?.summary || {};

    return {
      source: advancedBurnRate ? "Burn rate avanzado" : "Promedio diario",
      forecastSource: advancedForecast ? "Forecast avanzado" : "No disponible",
      projectedExpense,
      projectedOverBudget,
      expectedToDate: numberValue(advancedBurnRate?.expected_to_date),
      expectedEndOfMonth: numberValue(advancedBurnRate?.expected_total),
      actualToDate:
        advancedBurnRate?.actual_to_date != null
          ? numberValue(advancedBurnRate.actual_to_date)
          : numberValue(report?.summary?.expense),
      varianceToExpected: numberValue(advancedBurnRate?.variance_to_expected),
      varianceToEnd: numberValue(advancedBurnRate?.variance_to_expected_end),
      forecastExpense: numberValue(forecastSummary.total_expense),
      forecastIncome: numberValue(forecastSummary.total_income),
      forecastNet: numberValue(forecastSummary.net_projected),
      transactionsExpected: numberValue(forecastSummary.transactions_expected),
      forecastRows: Array.isArray(advancedForecast?.data)
        ? advancedForecast.data
        : [],
    };
  }, [advancedBurnRate, advancedForecast, report]);

  useEffect(() => {
    if (!isPremiumActive) {
      setLoading(false);
      return;
    }

    loadReport();
  }, [isPremiumActive, loadReport]);

  const insights = useMemo(
    () => buildInsights(report, projection),
    [projection, report]
  );

  if (!isNativeMobile) {
    return null;
  }

  if (!subscriptionMode) {
    return (
      <Surface>
        <p className="text-sm text-[var(--muted)]">Validando acceso...</p>
      </Surface>
    );
  }

  if (!isPremiumActive) {
    return <PremiumLocked setView={setView} />;
  }

  if (loading && !report) {
    return (
      <div className="space-y-4">
        <Surface>
          <p className="text-sm text-[var(--muted)]">Cargando reportes...</p>
        </Surface>
      </div>
    );
  }

  if (error && !report) {
    return (
      <Surface className="space-y-4">
        <div className="flex items-start gap-3">
          <HiExclamationCircle className="mt-0.5 h-6 w-6 shrink-0 text-[var(--danger)]" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)]">
              Reportes no disponibles
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadReport}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-[var(--text)]"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 76%, transparent)",
          }}
        >
          <HiRefresh className="h-4 w-4" /> Reintentar
        </button>
      </Surface>
    );
  }

  if (!report) {
    return (
      <Surface>
        <p className="text-sm text-[var(--muted)]">
          No hay datos de reportes para mostrar.
        </p>
      </Surface>
    );
  }

  const budgeted = numberValue(report?.budgets?.budgeted);
  const expense = numberValue(report?.summary?.expense);
  const projected = projection.projectedExpense;
  const net = numberValue(report?.summary?.net);
  const projectedOverBudget = projection.projectedOverBudget;
  const isProjectedOver = projectedOverBudget > 0;
  const monthLabel = formatMonthLabel(report?.month?.key);
  const trendIcon =
    numberValue(report?.summary?.expense_delta) > 0 ? HiTrendingUp : HiTrendingDown;
  const TrendIcon = trendIcon;
  const applyDraftParams = () => {
    if (Object.keys(validateReportParams(draftParams)).length > 0) {
      return;
    }

    setReportParams(sanitizeReportParams(draftParams));
  };
  const resetDraftParams = () => {
    setDraftParams(DEFAULT_REPORT_PARAMS);
    setReportParams(DEFAULT_REPORT_PARAMS);
  };

  return (
    <div className="space-y-4 pb-4">
      <Surface className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Gestion financiera
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">
              Reportes
            </h1>
            <p className="mt-1 text-sm capitalize text-[var(--muted)]">
              {monthLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[var(--text)] disabled:opacity-60"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 76%, transparent)",
            }}
            aria-label="Actualizar reportes"
          >
            <HiRefresh className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: toneBorder(isProjectedOver ? "danger" : "success"),
            background: `color-mix(in srgb, ${
              isProjectedOver ? "var(--danger)" : "var(--success)"
            } 10%, var(--panel))`,
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: toneColor(isProjectedOver ? "danger" : "success") }}
          >
            {isProjectedOver
              ? "Riesgo de exceso al cierre"
              : "Proyeccion controlada"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {isProjectedOver
              ? `La proyeccion supera el presupuesto por ${formatCurrency(projectedOverBudget)}.`
              : budgeted > 0
              ? `La proyeccion queda ${formatCurrency(Math.abs(projectedOverBudget))} por debajo del presupuesto.`
              : "Agrega presupuestos para medir el cierre del mes."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Gasto" value={formatCurrency(expense)} tone="danger" />
          <StatTile label="Ingresos" value={formatCurrency(report?.summary?.income)} tone="success" />
          <StatTile
            label="Neto"
            value={formatCurrency(net)}
            tone={net >= 0 ? "success" : "danger"}
          />
          <StatTile
            label="Cierre"
            value={formatCurrency(projected)}
            tone={isProjectedOver ? "danger" : "primary"}
            helper={projection.source}
          />
        </div>
      </Surface>

      <ParametersPanel
        draftParams={draftParams}
        appliedParams={reportParams}
        onDraftChange={setDraftParams}
        onApply={applyDraftParams}
        onReset={resetDraftParams}
      />

      {projectionError ? (
        <div
          className="rounded-lg border p-3 text-xs text-[var(--muted)]"
          style={{
            borderColor: "color-mix(in srgb, var(--warning) 42%, var(--border-rgba))",
            background: "color-mix(in srgb, var(--warning) 10%, var(--panel))",
          }}
        >
          {projectionError}
        </div>
      ) : null}

      <div
        className="grid grid-cols-4 gap-1 rounded-lg border p-1"
        style={{
          borderColor: "var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 86%, transparent)",
        }}
      >
        {tabOptions.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="rounded-md px-3 py-2 text-xs font-semibold"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--primary) 18%, var(--panel))"
                  : "transparent",
                color: active ? "var(--text)" : "var(--muted)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <>
          <Surface className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Ritmo del mes
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Dia {report.month.day_of_month} de {report.month.days_in_month}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
                <TrendIcon className="h-4 w-4" />
                {formatPercent(report.summary.expense_delta_pct, 0)}
              </div>
            </div>
            <DailyBars report={report} formatCurrency={formatCurrency} />
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Promedio diario"
                value={formatCurrency(report.summary.daily_average)}
              />
              <StatTile
                label="Margen diario"
                value={formatCurrency(report.summary.remaining_daily_allowance)}
                tone={
                  numberValue(report.summary.remaining_daily_allowance) <
                  numberValue(report.summary.daily_average)
                    ? "warning"
                    : "success"
                }
              />
            </div>
          </Surface>

          <Surface className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">
                Proyecciones
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {projection.source} + {projection.forecastSource}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Esperado hoy"
                value={formatCurrency(projection.expectedToDate)}
                tone="primary"
              />
              <StatTile
                label="Real hoy"
                value={formatCurrency(projection.actualToDate)}
                tone={
                  projection.varianceToExpected > 0 ? "danger" : "success"
                }
              />
              <StatTile
                label="Cierre burn"
                value={formatCurrency(projection.projectedExpense)}
                tone={isProjectedOver ? "danger" : "success"}
              />
              <StatTile
                label="Forecast"
                value={formatCurrency(projection.forecastExpense)}
                tone="warning"
                helper={`${projection.transactionsExpected} mov.`}
              />
            </div>

            <ForecastRawRows
              rows={projection.forecastRows}
              formatCurrency={formatCurrency}
            />
          </Surface>

          <Surface className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Top categorias
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Concentracion del gasto actual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView("categories")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
              >
                Ver <HiArrowRight className="h-4 w-4" />
              </button>
            </div>
            <CategoryRows
              rows={report.categories.top}
              formatCurrency={formatCurrency}
              emptyText="Todavia no hay gastos por categoria."
            />
          </Surface>
        </>
      ) : null}

      {activeTab === "year" ? (
        <>
          {!yearlyOverview ? (
            <Surface>
              <p className="text-sm text-[var(--muted)]">
                Cargando resumen anual...
              </p>
            </Surface>
          ) : (
            <>
              <Surface className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Overview {yearlyOverview.year}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
                    Resumen anual
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatTile
                    label="Ingresado"
                    value={formatCurrency(yearlyOverview.totals.income)}
                    tone="success"
                  />
                  <StatTile
                    label="Gastado"
                    value={formatCurrency(yearlyOverview.totals.expense)}
                    tone="danger"
                  />
                  <StatTile
                    label="Neto"
                    value={formatCurrency(yearlyOverview.totals.net)}
                    tone={yearlyOverview.totals.net >= 0 ? "success" : "danger"}
                  />
                  <StatTile
                    label="Ahorro"
                    value={formatPercent(yearlyOverview.totals.savings_rate_pct)}
                    tone={
                      yearlyOverview.totals.savings_rate_pct == null
                        ? "primary"
                        : yearlyOverview.totals.savings_rate_pct >= 0
                        ? "success"
                        : "danger"
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatTile
                    label="Prom. ingreso"
                    value={formatCurrency(
                      yearlyOverview.totals.average_monthly_income
                    )}
                    tone="success"
                    helper="Mes activo"
                  />
                  <StatTile
                    label="Prom. gasto"
                    value={formatCurrency(
                      yearlyOverview.totals.average_monthly_expense
                    )}
                    tone="danger"
                    helper="Mes activo"
                  />
                </div>

                <MonthBars
                  rows={yearlyOverview.monthly_summary}
                  formatCurrency={formatCurrency}
                />
              </Surface>

              <Surface className="space-y-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Meses clave
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  <StatTile
                    label="Mejor neto"
                    value={formatCurrency(
                      yearlyOverview.highlights.best_net_month?.net
                    )}
                    tone={
                      yearlyOverview.highlights.best_net_month?.net >= 0
                        ? "success"
                        : "danger"
                    }
                    helper={formatMonthLabel(
                      yearlyOverview.highlights.best_net_month?.month
                    )}
                  />
                  <StatTile
                    label="Mas ingreso"
                    value={formatCurrency(
                      yearlyOverview.highlights.highest_income_month?.income
                    )}
                    tone="success"
                    helper={formatMonthLabel(
                      yearlyOverview.highlights.highest_income_month?.month
                    )}
                  />
                  <StatTile
                    label="Mas gasto"
                    value={formatCurrency(
                      yearlyOverview.highlights.highest_expense_month?.expense
                    )}
                    tone="danger"
                    helper={formatMonthLabel(
                      yearlyOverview.highlights.highest_expense_month?.month
                    )}
                  />
                </div>
              </Surface>

              <Surface className="space-y-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Top categorias por gasto
                </h2>
                <CategoryRows
                  rows={yearlyOverview.top_expense_categories}
                  formatCurrency={formatCurrency}
                  emptyText="No hay categorias de gasto este año."
                  shareLabel="del gasto anual"
                />
              </Surface>

              <Surface className="space-y-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Top categorias por ingreso
                </h2>
                <CategoryRows
                  rows={yearlyOverview.top_income_categories}
                  formatCurrency={formatCurrency}
                  emptyText="No hay categorias de ingreso este año."
                  shareLabel="del ingreso anual"
                />
              </Surface>

              <Surface className="space-y-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Top transacciones
                </h2>
                <TransactionRows
                  rows={yearlyOverview.top_transactions}
                  formatCurrency={formatCurrency}
                  emptyText="No hay transacciones este año."
                />
                <details
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: "var(--border-rgba)",
                    background: "color-mix(in srgb, var(--panel) 76%, transparent)",
                  }}
                >
                  <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--text)]">
                    Top gastos
                  </summary>
                  <div className="mt-3">
                    <TransactionRows
                      rows={yearlyOverview.top_expense_transactions}
                      formatCurrency={formatCurrency}
                      emptyText="No hay gastos este año."
                    />
                  </div>
                </details>
                <details
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: "var(--border-rgba)",
                    background: "color-mix(in srgb, var(--panel) 76%, transparent)",
                  }}
                >
                  <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--text)]">
                    Top ingresos
                  </summary>
                  <div className="mt-3">
                    <TransactionRows
                      rows={yearlyOverview.top_income_transactions}
                      formatCurrency={formatCurrency}
                      emptyText="No hay ingresos este año."
                    />
                  </div>
                </details>
              </Surface>
            </>
          )}
        </>
      ) : null}

      {activeTab === "budget" ? (
        <>
          <Surface className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">
                Cobertura
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {formatPercent(report.budgets.coverage_pct)} cubierto por presupuesto.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Presupuesto" value={formatCurrency(budgeted)} />
              <StatTile
                label="Uso"
                value={formatPercent(report.budgets.used_pct, 0)}
                tone={report.budgets.used_pct > 100 ? "danger" : "primary"}
              />
              <StatTile
                label="Exceso"
                value={formatCurrency(report.budgets.over_budget)}
                tone={report.budgets.over_budget > 0 ? "danger" : "success"}
              />
              <StatTile
                label="Sin cubrir"
                value={formatCurrency(report.budgets.without_budget)}
                tone={report.budgets.without_budget > 0 ? "warning" : "success"}
              />
            </div>
          </Surface>

          <Surface className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                Presupuestos en foco
              </h2>
              <button
                type="button"
                onClick={() => setView("budgets")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
              >
                Ajustar <HiArrowRight className="h-4 w-4" />
              </button>
            </div>
            <BudgetRows rows={report.budgets.categories} formatCurrency={formatCurrency} />
          </Surface>

          <Surface className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Fuera de presupuesto
            </h2>
            <CategoryRows
              rows={report.budgets.without_budget_categories}
              formatCurrency={formatCurrency}
              emptyText="No hay gasto fuera de presupuesto."
            />
          </Surface>
        </>
      ) : null}

      {activeTab === "alerts" ? (
        <>
          <Surface className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Indicadores
            </h2>
            {insights.map((insight) => (
              <InsightCard
                key={insight.title}
                insight={insight}
                onNavigate={setView}
                formatCurrency={formatCurrency}
              />
            ))}
          </Surface>

          <Surface className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Gastos atipicos
            </h2>
            {report.alerts.unusual_expenses.length ? (
              <div className="space-y-3">
                {report.alerts.unusual_expenses.map((expenseRow) => (
                  <button
                    key={expenseRow.id}
                    type="button"
                    onClick={() => setView("transactions")}
                    className="w-full rounded-lg border p-3 text-left"
                    style={{
                      borderColor: toneBorder("danger"),
                      background: "color-mix(in srgb, var(--panel) 78%, transparent)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">
                          {expenseRow.description}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {expenseRow.category_name} - {expenseRow.date}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[var(--danger)]">
                        {formatCurrency(expenseRow.amount)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--muted)]">
                      {formatCurrency(expenseRow.above_baseline)} sobre el patron
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-[var(--muted)]">
                No se detectaron gastos atipicos este mes.
              </p>
            )}
          </Surface>

          <Surface className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                Liquidez y metas
              </h2>
              <button
                type="button"
                onClick={() => setView("goals")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
              >
                Metas <HiArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Disponible"
                value={formatCurrency(report.accounts.available_balance)}
                tone={report.accounts.available_balance >= 0 ? "success" : "danger"}
              />
              <StatTile
                label="Reservado"
                value={formatCurrency(report.accounts.reserved_total)}
                tone="warning"
              />
            </div>
            {report.goals.top_goals.length ? (
              <div className="space-y-3">
                {report.goals.top_goals.map((goal) => (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-[var(--text)]">
                        {goal.name}
                      </span>
                      <span className="shrink-0 font-semibold text-[var(--primary)]">
                        {formatPercent(goal.progress_pct, 0)}
                      </span>
                    </div>
                    <ProgressLine value={goal.progress_pct} max={100} tone="success" />
                    <p className="text-[11px] text-[var(--muted)]">
                      Faltan {formatCurrency(goal.remaining_amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-[var(--muted)]">
                No hay metas activas.
              </p>
            )}
          </Surface>
        </>
      ) : null}
    </div>
  );
}

export default MobileReports;
