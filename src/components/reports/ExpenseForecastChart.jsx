import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/* ================= Utils ================= */

function toISODate(d) {
  return new Date(d).toISOString().split("T")[0];
}

function lastDayOfMonthISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toISODate(last);
}

function formatMoney(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(n);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/* ================= Token helpers ================= */

function toneToken(tone) {
  switch (tone) {
    case "danger":
    case "rose":
      return "var(--danger)";
    case "success":
    case "emerald":
      return "var(--success)";
    case "warning":
    case "amber":
      return "var(--warning)";
    case "primary":
    case "sky":
      return "var(--primary)";
    default:
      return "var(--text)";
  }
}

/* ================= UI bits ================= */

function TabPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-xl text-sm font-bold border transition
        ${
          active
            ? "bg-[var(--text)] text-[var(--bg-1)] border-[color-mix(in srgb,var(--text)_22%,transparent)] shadow-[0_10px_28px_color-mix(in srgb,var(--text)_12%,transparent)]"
            : "bg-[color-mix(in srgb,var(--panel)_55%,transparent)] text-[var(--text)] border-[var(--border-rgba)] hover:bg-[color-mix(in srgb,var(--panel)_70%,transparent)]"
        }
      `}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, tone = "default", size = "md" }) {
  const token = toneToken(tone);

  const sizeClass =
    size === "sm"
      ? "text-[clamp(24px,1.6vw,20px)]"
      : "text-[clamp(18px,2.2vw,28px)]";

  return (
    <div
      className={`
        rounded-2xl border
        px-4 py-4
        min-h-[96px]
        flex flex-col justify-between
        min-w-0
      `}
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom, color-mix(in srgb,var(--panel)_72%,transparent), color-mix(in srgb,var(--panel)_38%,transparent))",
        boxShadow: `0 14px 45px color-mix(in srgb, ${token} 10%, transparent)`,
      }}
    >
      <div className="text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)]">
        {label}
      </div>

      <div
        className={`
          font-extrabold tracking-tight tabular-nums
          whitespace-nowrap
          leading-tight
          ${sizeClass}
        `}
        style={{ color: `color-mix(in srgb, ${token} 92%, var(--text))` }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone = "default" }) {
  const token = toneToken(tone);

  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 55%, transparent)",
      }}
    >
      <div className="text-[11px] font-semibold text-[color-mix(in srgb,var(--text)_82%,transparent)]">
        {label}
      </div>

      <div
        className={`
          font-extrabold tabular-nums
          whitespace-nowrap
          leading-tight
          text-[clamp(12px,1.5vw,16px)]
        `}
        style={{ color: `color-mix(in srgb, ${token} 92%, var(--text))` }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({ tone = "default", children }) {
  const token = toneToken(tone);

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border"
      style={{
        background: `color-mix(in srgb, ${token} 14%, transparent)`,
        color: `color-mix(in srgb, ${token} 85%, var(--text))`,
        borderColor: "var(--border-rgba)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Tooltip reutilizable (tokenizado)
 * Requiere primitives en index.css:
 *  - .ff-tooltip
 */
function InfoTip({ children, widthClass = "w-56" }) {
  return (
    <span className="relative inline-flex items-center group cursor-help select-none">
      <span className="opacity-85">ℹ</span>

      <span
        className={`
          pointer-events-none absolute z-20
          top-full right-0 mt-1
          ${widthClass}
          opacity-0 scale-95
          group-hover:opacity-100 group-hover:scale-100
          transition
        `}
      >
        <span className="ff-tooltip block text-xs font-medium leading-snug">
          {children}
        </span>
      </span>
    </span>
  );
}

/* ================= Component ================= */

export default function GeneralMonthlyProjection({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const defaultDateTo = useMemo(() => lastDayOfMonthISO(todayISO), [todayISO]);

  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [months, setMonths] = useState(3);
  const [minOccurrences, setMinOccurrences] = useState(3);
  const [limit, setLimit] = useState(15);

  const [includeOccasional, setIncludeOccasional] = useState(false);
  const [includeNoise, setIncludeNoise] = useState(true);

  const [tab, setTab] = useState("expense"); // "expense" | "cashflow"
  const includeIncome = tab === "cashflow";
  const includeBalance = tab === "cashflow";

  const [minIntervalDays, setMinIntervalDays] = useState(3);
  const [maxIntervalDays, setMaxIntervalDays] = useState(70);
  const [maxCoefVariation, setMaxCoefVariation] = useState(0.6);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const didInitialLoad = useRef(false);

  useEffect(() => {
    if (!dateFrom) return;
    setDateTo(lastDayOfMonthISO(dateFrom));
  }, [dateFrom]);

  const loadData = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const types = includeIncome ? "expense,income" : "expense";

      const res = await axios.get(`${api}/analytics/expense-forecast`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          months,
          min_occurrences: minOccurrences,
          limit,
          include_occasional: includeOccasional,
          include_noise: includeNoise,
          min_interval_days: minIntervalDays,
          max_interval_days: maxIntervalDays,
          max_coef_variation: maxCoefVariation,
          types,
          include_balance: includeBalance,
        },
      });

      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error("GeneralMonthlyProjection error:", err);
      setError(
        err.response?.data?.error || "No se pudo calcular la proyección."
      );
      setRows([]);
      setMeta(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!didInitialLoad.current) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Derived
  const totalIncome = Number(summary?.total_income || 0);
  const totalExpense = Number(summary?.total_expense || 0);
  const txExpected = Number(summary?.transactions_expected || 0);

  const bal = summary?.balance || null;
  const totalCurrent = Number(bal?.total_current || 0);
  const inGoals = Number(bal?.total_reserved || 0);
  const availableCurrent = Number(bal?.total_available || 0);

  const totalProjected = includeBalance
    ? totalCurrent + totalIncome - totalExpense
    : null;

  const availableProjected = includeBalance
    ? availableCurrent + totalIncome - totalExpense
    : null;

  const historyLabel =
    meta?.history_from && meta?.history_to
      ? `${formatDateShort(meta.history_from)} → ${formatDateShort(
          meta.history_to
        )}`
      : "—";

  const rangeLabel =
    meta?.date_from && meta?.date_to
      ? `${formatDateShort(meta.date_from)} → ${formatDateShort(meta.date_to)}`
      : `${formatDateShort(dateFrom)} → ${formatDateShort(dateTo)}`;

  return (
    <div
      className="rounded-2xl p-6 space-y-4 overflow-hidden border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom, var(--bg-1), color-mix(in srgb, var(--bg-1) 70%, transparent), color-mix(in srgb, var(--panel) 40%, transparent))",
        boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
            Proyeccion de flujo por período
          </h3>
          <p className="text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)] mt-1 max-w-4xl">
            Proyección por período basada en patrones recurrentes + eventos. En
            Flujo se incluye ingresos y balance disponible (restando lo asignado
            a metas).
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 min-w-0">
            <div className="flex flex-wrap gap-2">
              <TabPill
                active={tab === "expense"}
                onClick={() => setTab("expense")}
              >
                Gastos
              </TabPill>
              <TabPill
                active={tab === "cashflow"}
                onClick={() => setTab("cashflow")}
              >
                Flujo (Ingresos + Gastos)
              </TabPill>
            </div>

            <div className="text-xs text-[color-mix(in srgb,var(--text)_76%,transparent)] min-w-0 truncate">
              <span className="font-bold text-[color-mix(in srgb,var(--text)_90%,transparent)]">
                Historial usado:
              </span>{" "}
              {historyLabel}
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="ff-btn ff-btn-primary self-start lg:self-auto disabled:opacity-60"
        >
          {loading ? "Proyectando..." : "Proyectar"}
        </button>
      </div>

      {error ? (
        <div
          className="text-sm rounded-xl p-3 border"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            color: "color-mix(in srgb, var(--danger) 85%, var(--text))",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Gasto proyectado"
            value={formatMoney(totalExpense)}
            tone="danger"
            size="sm"
          />
          <StatCard
            label="Ingreso proyectado"
            value={includeIncome ? formatMoney(totalIncome) : "—"}
            tone="success"
            size="sm"
          />
          <StatCard
            label="Saldo proyectado"
            value={includeBalance ? formatMoney(totalProjected) : "—"}
            tone={
              includeBalance
                ? Number(totalProjected || 0) >= 0
                  ? "success"
                  : "danger"
                : "default"
            }
            size="sm"
          />
          <StatCard
            label="Transacciones esperadas"
            value={String(txExpected)}
            tone="warning"
            size="sm"
          />
        </div>

        {/* Balance */}
        <div className="grid grid-cols-1">
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 55%, transparent)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-[var(--text)]">
                Balance (cuentas)
              </div>
              <div className="text-xs text-[color-mix(in srgb,var(--text)_76%,transparent)] whitespace-nowrap">
                {tab === "cashflow" ? rangeLabel : "—"}
              </div>
            </div>

            {tab !== "cashflow" ? (
              <div className="mt-2 text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)]">
                Cambia a <span className="font-extrabold">Flujo</span> para ver
                el balance disponible.
              </div>
            ) : !bal ? (
              <div className="mt-2 text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)]">
                No se recibió balance desde el backend.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniMetric
                  label="Total actual"
                  value={formatMoney(totalCurrent)}
                />
                <MiniMetric
                  label="En metas"
                  value={formatMoney(inGoals)}
                  tone="warning"
                />
                <MiniMetric
                  label="Disponible actual"
                  value={formatMoney(availableCurrent)}
                  tone="success"
                />
                <MiniMetric
                  label="Disponible proyectado"
                  value={formatMoney(availableProjected)}
                  tone={
                    Number(availableProjected || 0) >= 0 ? "success" : "danger"
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: "var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 35%, transparent)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-5">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Rango
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="ff-input w-full min-w-0"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="ff-input w-full min-w-0"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Historial (meses)
            </label>
            <input
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={(e) => setMonths(clamp(Number(e.target.value), 1, 36))}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Min. ocurrencias
            </label>
            <input
              type="number"
              min={2}
              max={50}
              value={minOccurrences}
              onChange={(e) =>
                setMinOccurrences(clamp(Number(e.target.value), 2, 50))
              }
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Top
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(clamp(Number(e.target.value), 1, 50))}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={includeOccasional}
                onChange={(e) => setIncludeOccasional(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              Incluir ocasionales
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={includeNoise}
                onChange={(e) => setIncludeNoise(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              Incluir eventos
            </label>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-[var(--text)] select-none">
            Ajustes avanzados
          </summary>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Min intervalo (días)
              </label>
              <input
                type="number"
                min={1}
                value={minIntervalDays}
                onChange={(e) =>
                  setMinIntervalDays(clamp(Number(e.target.value), 1, 365))
                }
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Max intervalo (días)
              </label>
              <input
                type="number"
                min={1}
                value={maxIntervalDays}
                onChange={(e) =>
                  setMaxIntervalDays(clamp(Number(e.target.value), 1, 3650))
                }
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Coef. variación máx
              </label>
              <input
                type="number"
                step="0.05"
                min={0.05}
                max={2}
                value={maxCoefVariation}
                onChange={(e) => setMaxCoefVariation(Number(e.target.value))}
                className="ff-input w-full"
              />
            </div>
          </div>
        </details>
      </div>

      {/* Table */}
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--border-rgba)",
          background:
            "linear-gradient(to bottom right, color-mix(in srgb,var(--panel)_60%,transparent), color-mix(in srgb,var(--panel)_35%,transparent), color-mix(in srgb,var(--panel)_22%,transparent))",
          boxShadow: "0 18px 55px rgba(0,0,0,0.35)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-[1px] rounded-2xl"
          style={{
            border: "1px solid color-mix(in srgb, var(--text) 6%, transparent)",
          }}
        />

        <div
          className="relative px-3 py-2 border-b flex items-center justify-between"
          style={{
            borderColor:
              "color-mix(in srgb, var(--border-rgba) 75%, transparent)",
          }}
        >
          <div className="text-sm text-[var(--text)] font-extrabold">
            Detalle de patrones
          </div>
          <div className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] whitespace-nowrap">
            {rangeLabel}
          </div>
        </div>

        <div className="relative overflow-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="ff-thead">
                <th className="text-left w-[38%]">Patrón</th>

                <th className="text-right w-[14%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Proy.{" "}
                    <InfoTip widthClass="w-56">
                      Monto total estimado proyectado para el período
                      seleccionado.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[6%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    #{" "}
                    <InfoTip widthClass="w-48">
                      Cantidad de ocurrencias esperadas en el período.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[8%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Int.{" "}
                    <InfoTip widthClass="w-52">
                      Intervalo mediano (en días) entre transacciones del
                      patrón.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Monto{" "}
                    <InfoTip widthClass="w-48">
                      Valor típico (mediano) de cada transacción.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-center w-[10%]">Mov.</th>
                <th className="text-center w-[10%]">Tipo</th>

                <th className="text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Última{" "}
                    <InfoTip widthClass="w-52">
                      Fecha de la última transacción detectada en el historial.
                    </InfoTip>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody
              className="divide-y"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--border-rgba) 65%, transparent)",
              }}
            >
              {(rows || []).map((r, idx) => {
                const isEvent = r.type === "event";
                const isIncomeRow = r.tx_type === "income";

                return (
                  <tr
                    key={`${r.pattern}-${idx}`}
                    className={idx % 2 === 0 ? "ff-row" : "ff-row-alt"}
                  >
                    <td className="px-2 py-2 text-[var(--text)] align-top">
                      <div className="text-[13px] font-semibold leading-snug whitespace-normal break-words">
                        {r.pattern}
                      </div>
                    </td>

                    <td className="px-2 py-2 text-right align-top">
                      <span
                        className="font-semibold tabular-nums"
                        style={{
                          color:
                            "color-mix(in srgb, var(--warning) 92%, var(--text))",
                        }}
                      >
                        {formatMoney(r.projection)}
                      </span>
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] font-semibold tabular-nums align-top">
                      {r.expected_count ?? "—"}
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums align-top">
                      {r.median_interval_days != null
                        ? `${r.median_interval_days}d`
                        : "—"}
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums align-top">
                      {formatMoney(r.median_amount || 0)}
                    </td>

                    <td className="px-2 py-2 text-center align-top">
                      {/* regla app: ingreso=success, gasto=danger */}
                      <Badge tone={isIncomeRow ? "success" : "danger"}>
                        {isIncomeRow ? "Ingreso" : "Gasto"}
                      </Badge>
                    </td>

                    <td className="px-2 py-2 text-center align-top">
                      <Badge tone={isEvent ? "warning" : "primary"}>
                        {isEvent ? "Evento" : "Recurrente"}
                      </Badge>
                    </td>

                    <td className="px-2 py-2 text-right tabular-nums align-top whitespace-nowrap text-[color-mix(in srgb,var(--text)_86%,transparent)]">
                      {formatDateShort(r.last_date)}
                    </td>
                  </tr>
                );
              })}

              {!loading && (!rows || rows.length === 0) ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center"
                    style={{
                      color: "color-mix(in srgb,var(--text)_70%,transparent)",
                    }}
                    colSpan={8}
                  >
                    Sin resultados con estos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
