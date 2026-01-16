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
            ? "bg-slate-100 text-slate-950 border-slate-200 shadow-[0_10px_28px_rgba(255,255,255,0.10)]"
            : "bg-slate-950/20 text-slate-100 border-slate-700/70 hover:bg-slate-900/35"
        }
      `}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, tone = "default", size = "md" }) {
  const toneText =
    tone === "rose"
      ? "text-rose-200"
      : tone === "sky"
      ? "text-sky-200"
      : tone === "emerald"
      ? "text-emerald-200"
      : tone === "amber"
      ? "text-amber-200"
      : "text-slate-100";

  const glow =
    tone === "rose"
      ? "shadow-[0_14px_45px_rgba(244,63,94,0.08)]"
      : tone === "sky"
      ? "shadow-[0_14px_45px_rgba(56,189,248,0.08)]"
      : tone === "emerald"
      ? "shadow-[0_14px_45px_rgba(16,185,129,0.09)]"
      : tone === "amber"
      ? "shadow-[0_14px_45px_rgba(245,158,11,0.10)]"
      : "shadow-[0_14px_45px_rgba(255,255,255,0.04)]";

  const sizeClass =
    size === "sm"
      ? "text-[clamp(24px,1.6vw,20px)]"
      : "text-[clamp(18px,2.2vw,28px)]";

  return (
    <div
      className={`
        rounded-2xl border border-slate-700/70
        bg-gradient-to-b from-slate-950/60 to-slate-900/25
        px-4 py-4
        ${glow}
        min-h-[96px]
        flex flex-col justify-between
        min-w-0
      `}
    >
      <div className="text-sm text-slate-100/90">{label}</div>

      {/* ✅ NO truncar + tamaño fluido (clamp) */}
      <div
        className={`
          font-extrabold tracking-tight tabular-nums ${toneText}
          whitespace-nowrap
          leading-tight
          ${sizeClass}
        `}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone = "slate" }) {
  const c =
    tone === "emerald"
      ? "text-emerald-200"
      : tone === "amber"
      ? "text-amber-200"
      : tone === "sky"
      ? "text-sky-200"
      : tone === "rose"
      ? "text-rose-200"
      : "text-slate-100";

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/35 px-3 py-2">
      <div className="text-[11px] text-slate-100/85 font-semibold">{label}</div>

      {/* ✅ NO truncar nunca + tamaño fluido */}
      <div
        className={`
          font-extrabold tabular-nums ${c}
          whitespace-nowrap
          leading-tight
          text-[clamp(12px,1.5vw,16px)]
        `}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({ tone = "slate", children }) {
  const c =
    tone === "sky"
      ? "bg-sky-400/16 text-sky-200 border-sky-300/30"
      : tone === "rose"
      ? "bg-rose-400/16 text-rose-200 border-rose-300/30"
      : tone === "emerald"
      ? "bg-emerald-400/16 text-emerald-200 border-emerald-300/30"
      : tone === "amber"
      ? "bg-amber-400/16 text-amber-200 border-amber-300/30"
      : "bg-slate-400/12 text-slate-100 border-slate-300/20";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${c}`}
    >
      {children}
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
      className="
        rounded-2xl p-6
        border border-slate-700/70
        bg-gradient-to-b from-slate-950 via-slate-950/70 to-slate-900/40
        shadow-[0_18px_55px_rgba(0,0,0,0.65)]
        space-y-4
        overflow-hidden
      "
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Proyeccion de flujo por período
          </h3>
          <p className="text-sm text-slate-100/90 mt-1 max-w-4xl">
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

            <div className="text-xs text-slate-100/80 min-w-0 truncate">
              <span className="font-bold text-slate-100/90">
                Historial usado:
              </span>{" "}
              {historyLabel}
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="
            self-start lg:self-auto
            px-5 py-2.5 rounded-xl text-sm font-extrabold
            bg-gradient-to-r from-amber-400 to-amber-300
            text-slate-950
            shadow-[0_12px_35px_rgba(245,158,11,0.35)]
            hover:brightness-110 active:scale-[0.98] transition
            disabled:opacity-60
          "
        >
          {loading ? "Proyectando..." : "Proyectar"}
        </button>
      </div>

      {error ? (
        <div className="text-sm text-rose-100 border border-rose-400/30 rounded-xl p-3 bg-rose-500/10">
          {error}
        </div>
      ) : null}

      {/* ✅ KPIs: 3 cards por fila (no contraen), y debajo balance horizontal */}

      <div className="space-y-3">
        {/* Fila superior: KPIs + Transacciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Gasto proyectado"
            value={formatMoney(totalExpense)}
            tone="rose"
            size="sm"
          />
          <StatCard
            label="Ingreso proyectado"
            value={includeIncome ? formatMoney(totalIncome) : "—"}
            tone="sky"
            size="sm"
          />
          <StatCard
            label="Saldo proyectado"
            value={includeBalance ? formatMoney(totalProjected) : "—"}
            tone={
              includeBalance
                ? Number(totalProjected || 0) >= 0
                  ? "emerald"
                  : "rose"
                : "default"
            }
            size="sm"
          />
          <StatCard
            label="Transacciones esperadas"
            value={String(txExpected)}
            tone="amber"
            size="sm"
          />
        </div>

        {/* Fila inferior: Balance horizontal */}
        <div className="grid grid-cols-1">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-100">
                Balance (cuentas)
              </div>
              <div className="text-xs text-slate-100/80 whitespace-nowrap">
                {tab === "cashflow" ? rangeLabel : "—"}
              </div>
            </div>

            {tab !== "cashflow" ? (
              <div className="mt-2 text-sm text-slate-100/90">
                Cambia a <span className="font-extrabold">Flujo</span> para ver
                el balance disponible.
              </div>
            ) : !bal ? (
              <div className="mt-2 text-sm text-slate-100/90">
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
                  tone="amber"
                />
                <MiniMetric
                  label="Disponible actual"
                  value={formatMoney(availableCurrent)}
                  tone="emerald"
                />
                <MiniMetric
                  label="Disponible proyectado"
                  value={formatMoney(availableProjected)}
                  tone={
                    Number(availableProjected || 0) >= 0 ? "emerald" : "rose"
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/25 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label className="text-xs text-slate-100/90 mb-1 block">
              Rango
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-full"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-slate-100/90 mb-1 block">
              Historial (meses)
            </label>
            <input
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={(e) => setMonths(clamp(Number(e.target.value), 1, 36))}
              className="input w-full"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-slate-100/90 mb-1 block">
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
              className="input w-full"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-slate-100/90 mb-1 block">Top</label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(clamp(Number(e.target.value), 1, 50))}
              className="input w-full"
            />
          </div>

          <div className="lg:col-span-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                checked={includeOccasional}
                onChange={(e) => setIncludeOccasional(e.target.checked)}
              />
              Incluir ocasionales
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                checked={includeNoise}
                onChange={(e) => setIncludeNoise(e.target.checked)}
              />
              Incluir eventos
            </label>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-slate-100 select-none">
            Ajustes avanzados
          </summary>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-100/90 mb-1 block">
                Min intervalo (días)
              </label>
              <input
                type="number"
                min={1}
                value={minIntervalDays}
                onChange={(e) =>
                  setMinIntervalDays(clamp(Number(e.target.value), 1, 365))
                }
                className="input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-slate-100/90 mb-1 block">
                Max intervalo (días)
              </label>
              <input
                type="number"
                min={1}
                value={maxIntervalDays}
                onChange={(e) =>
                  setMaxIntervalDays(clamp(Number(e.target.value), 1, 3650))
                }
                className="input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-slate-100/90 mb-1 block">
                Coef. variación máx
              </label>
              <input
                type="number"
                step="0.05"
                min={0.05}
                max={2}
                value={maxCoefVariation}
                onChange={(e) => setMaxCoefVariation(Number(e.target.value))}
                className="input w-full"
              />
            </div>
          </div>
        </details>
      </div>

      {/* Table */}
      <div
        className="
          relative overflow-hidden rounded-2xl
          border border-slate-700/70
          bg-gradient-to-br from-slate-950/70 via-slate-950/40 to-slate-900/30
          shadow-[0_18px_55px_rgba(0,0,0,0.55)]
        "
      >
        <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-white/5" />

        <div className="relative px-3 py-2 border-b border-slate-700/60 flex items-center justify-between">
          <div className="text-sm text-slate-100 font-extrabold">
            Detalle de patrones
          </div>
          <div className="text-xs text-slate-100/90 whitespace-nowrap">
            {rangeLabel}
          </div>
        </div>

        <div className="relative overflow-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr
                className="
      bg-slate-900/55
      [box-shadow:inset_0_-1px_0_rgba(255,255,255,0.06)]
      [&>th]:px-2 [&>th]:py-2
      [&>th]:text-[11px] [&>th]:font-extrabold
      [&>th]:uppercase [&>th]:tracking-wider
      [&>th]:text-slate-100/90
    "
              >
                <th className="text-left w-[38%]">Patrón</th>

                {/* Proyección */}
                <th className="relative text-right w-[14%]">
                  <div className="inline-flex items-center gap-1 group cursor-help justify-end">
                    Proy.
                    <span className="text-slate-300">ℹ</span>
                    <div
                      className="
            pointer-events-none
            absolute z-20
            top-full right-0 mt-1
            w-56
            rounded-lg
            bg-slate-900
            text-xs text-slate-100 font-medium leading-snug
            px-3 py-2
            opacity-0 scale-95
            group-hover:opacity-100 group-hover:scale-100
            transition
            shadow-xl
          "
                    >
                      Monto total estimado proyectado para el período
                      seleccionado.
                    </div>
                  </div>
                </th>

                {/* Cantidad */}
                <th className="relative text-right w-[6%]">
                  <div className="inline-flex items-center gap-1 group cursor-help justify-end">
                    #<span className="text-slate-300">ℹ</span>
                    <div
                      className="
            pointer-events-none
            absolute z-20
            top-full right-0 mt-1
            w-48
            rounded-lg
            bg-slate-900
            text-xs text-slate-100 font-medium leading-snug
            px-3 py-2
            opacity-0 scale-95
            group-hover:opacity-100 group-hover:scale-100
            transition
            shadow-xl
          "
                    >
                      Cantidad de ocurrencias esperadas en el período.
                    </div>
                  </div>
                </th>

                {/* Intervalo */}
                <th className="relative text-right w-[8%]">
                  <div className="inline-flex items-center gap-1 group cursor-help justify-end">
                    Int.
                    <span className="text-slate-300">ℹ</span>
                    <div
                      className="
            pointer-events-none
            absolute z-20
            top-full right-0 mt-1
            w-52
            rounded-lg
            bg-slate-900
            text-xs text-slate-100 font-medium leading-snug
            px-3 py-2
            opacity-0 scale-95
            group-hover:opacity-100 group-hover:scale-100
            transition
            shadow-xl
          "
                    >
                      Intervalo mediano (en días) entre transacciones del
                      patrón.
                    </div>
                  </div>
                </th>

                {/* Monto */}
                <th className="relative text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 group cursor-help justify-end">
                    Monto
                    <span className="text-slate-300">ℹ</span>
                    <div
                      className="
            pointer-events-none
            absolute z-20
            top-full right-0 mt-1
            w-48
            rounded-lg
            bg-slate-900
            text-xs text-slate-100 font-medium leading-snug
            px-3 py-2
            opacity-0 scale-95
            group-hover:opacity-100 group-hover:scale-100
            transition
            shadow-xl
          "
                    >
                      Valor típico (mediano) de cada transacción.
                    </div>
                  </div>
                </th>

                <th className="text-center w-[10%]">Mov.</th>
                <th className="text-center w-[10%]">Tipo</th>

                {/* Última */}
                <th className="relative text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 group cursor-help justify-end">
                    Última
                    <span className="text-slate-300">ℹ</span>
                    <div
                      className="
            pointer-events-none
            absolute z-20
            top-full right-0 mt-1
            w-52
            rounded-lg
            bg-slate-900
            text-xs text-slate-100 font-medium leading-snug
            px-3 py-2
            opacity-0 scale-95
            group-hover:opacity-100 group-hover:scale-100
            transition
            shadow-xl
          "
                    >
                      Fecha de la última transacción detectada en el historial.
                    </div>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {(rows || []).map((r, idx) => {
                const isEvent = r.type === "event";
                const isIncomeRow = r.tx_type === "income";

                return (
                  <tr
                    key={`${r.pattern}-${idx}`}
                    className={`
                      ${idx % 2 === 0 ? "bg-slate-950/18" : "bg-slate-900/20"}
                      hover:bg-slate-800/35 transition-colors
                    `}
                  >
                    <td className="px-2 py-2 text-slate-100 align-top">
                      <div className="text-[13px] font-semibold leading-snug whitespace-normal break-words">
                        {r.pattern}
                      </div>
                    </td>

                    <td className="px-2 py-2 text-right align-top">
                      <span className="text-amber-200 font-semibold tabular-nums">
                        {formatMoney(r.projection)}
                      </span>
                    </td>

                    <td className="px-2 py-2 text-right text-slate-100 font-semibold tabular-nums align-top">
                      {r.expected_count ?? "—"}
                    </td>

                    <td className="px-2 py-2 text-right text-slate-100 tabular-nums align-top">
                      {r.median_interval_days != null
                        ? `${r.median_interval_days}d`
                        : "—"}
                    </td>

                    <td className="px-2 py-2 text-right text-slate-100 tabular-nums align-top">
                      {formatMoney(r.median_amount || 0)}
                    </td>

                    <td className="px-2 py-2 text-center align-top">
                      <Badge tone={isIncomeRow ? "sky" : "rose"}>
                        {isIncomeRow ? "Ingreso" : "Gasto"}
                      </Badge>
                    </td>

                    <td className="px-2 py-2 text-center align-top">
                      <Badge tone={isEvent ? "amber" : "emerald"}>
                        {isEvent ? "Evento" : "Recurrente"}
                      </Badge>
                    </td>

                    <td className="px-2 py-2 text-right text-slate-100/90 tabular-nums align-top whitespace-nowrap">
                      {formatDateShort(r.last_date)}
                    </td>
                  </tr>
                );
              })}

              {!loading && (!rows || rows.length === 0) ? (
                <tr>
                  <td
                    className="px-3 py-10 text-slate-100/80 text-center"
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
