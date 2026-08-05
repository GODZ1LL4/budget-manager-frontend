import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { HiRefresh } from "react-icons/hi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import FFSelect from "../FFSelect";
import { currentMonthKey, withUserTimeZone } from "../../lib/dates/localDate";

const MONTH_OPTIONS = [
  { value: "1", label: "01 - Enero" },
  { value: "2", label: "02 - Febrero" },
  { value: "3", label: "03 - Marzo" },
  { value: "4", label: "04 - Abril" },
  { value: "5", label: "05 - Mayo" },
  { value: "6", label: "06 - Junio" },
  { value: "7", label: "07 - Julio" },
  { value: "8", label: "08 - Agosto" },
  { value: "9", label: "09 - Septiembre" },
  { value: "10", label: "10 - Octubre" },
  { value: "11", label: "11 - Noviembre" },
  { value: "12", label: "12 - Diciembre" },
];

const safeNum = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const money = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(safeNum(value));

const signedMoney = (value) => {
  const amount = safeNum(value);
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}${money(Math.abs(amount))}`;
};

const getDefaultPeriod = () => {
  const monthKey = currentMonthKey();
  return {
    year: Number(monthKey.slice(0, 4)),
    month: Number(monthKey.slice(5, 7)),
  };
};

function SummaryCard({ label, value, tone = "neutral", helper }) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--text)";

  return (
    <div
      className="min-w-0 rounded-lg border p-4"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 68%, transparent)",
      }}
    >
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-2 min-w-0 text-xl font-extrabold leading-tight [overflow-wrap:anywhere]"
        style={{ color }}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{helper}</p>
      ) : null}
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const neto = safeNum(row.neto);
  const netoColor = neto >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        backgroundColor: "var(--bg-3)",
        borderColor: "var(--border-rgba)",
        color: "var(--text)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
      }}
    >
      <p className="mb-1 font-bold text-[var(--text)]">
        {row.category || "Categoria"}
      </p>
      <p className="m-0 text-[var(--muted)]">
        Presupuesto:{" "}
        <span className="font-bold text-[var(--text)]">
          {money(row.presupuesto)}
        </span>
      </p>
      <p className="m-0 text-[var(--muted)]">
        Gastado:{" "}
        <span className="font-bold text-[var(--danger)]">
          {money(row.gastado)}
        </span>
      </p>
      <p className="m-0 mt-1 font-extrabold" style={{ color: netoColor }}>
        Neto: {signedMoney(neto)}
      </p>
    </div>
  );
}

function BudgetVsActualChart({ token }) {
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [data, setData] = useState([]);
  const [yearDraft, setYearDraft] = useState(String(defaultPeriod.year));
  const [monthDraft, setMonthDraft] = useState(String(defaultPeriod.month));
  const [appliedPeriod, setAppliedPeriod] = useState(defaultPeriod);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const api = import.meta.env.VITE_API_URL;

  const loadReport = useCallback(
    async ({ year, month }) => {
      if (!token) return;

      setLoading(true);
      setErrorMsg("");

      try {
        const res = await axios.get(
          `${api}/analytics/budget-vs-actual`,
          withUserTimeZone({
            headers: { Authorization: `Bearer ${token}` },
            params: { year, month },
          })
        );

        setData(res.data.data || []);
      } catch (err) {
        console.error("Error al cargar presupuesto vs real:", err);
        setData([]);
        setErrorMsg("No se pudo cargar el reporte para el periodo seleccionado.");
      } finally {
        setLoading(false);
      }
    },
    [api, token]
  );

  useEffect(() => {
    if (!token) return;

    loadReport(appliedPeriod);
  }, [appliedPeriod, loadReport, token]);

  const selectedPeriodLabel = useMemo(() => {
    const monthOption = MONTH_OPTIONS.find(
      (option) => String(option.value) === String(appliedPeriod.month)
    );
    const monthLabel =
      monthOption?.label?.split(" - ")[1] ||
      String(appliedPeriod.month).padStart(2, "0");

    return `${monthLabel} ${appliedPeriod.year}`;
  }, [appliedPeriod]);

  const handleRefresh = useCallback(() => {
    const nextYear = Number(String(yearDraft).trim());
    const nextMonth = Number(monthDraft);

    if (
      !Number.isInteger(nextYear) ||
      nextYear < 2000 ||
      nextYear > 2100 ||
      !Number.isInteger(nextMonth) ||
      nextMonth < 1 ||
      nextMonth > 12
    ) {
      setErrorMsg("Selecciona un ano y un mes validos.");
      return;
    }

    setAppliedPeriod({ year: nextYear, month: nextMonth });
  }, [monthDraft, yearDraft]);

  const onFilterKeyDown = (event) => {
    if (event.key === "Enter") handleRefresh();
  };

  // ====== Tokenized UI (solo vars) ======
  const ui = useMemo(() => {
    const card = {
      background:
        "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 80%, transparent), var(--bg-2))",
      border: "1px solid var(--border-rgba)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      color: "var(--text)",
    };

    const tooltip = {
      backgroundColor: "var(--bg-3)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "12px",
      boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
      fontSize: "0.95rem",
      padding: "10px 12px",
    };

    return {
      card,
      tooltip,
      grid: { stroke: "var(--border-rgba)", strokeDasharray: "4 4" },
      axisStroke: "var(--muted)",
      tick: { fill: "var(--text)", fontSize: 14 },
      legendWrap: { color: "var(--text)" },

      // Series colors (tokenized)
      budgetFill: "var(--primary)",
      actualFill: "var(--danger)",
    };
  }, []);

  const chartData = useMemo(
    () =>
      (data || []).map((row) => {
        const presupuesto = safeNum(row.presupuesto);
        const gastado = safeNum(row.gastado);

        return {
          ...row,
          presupuesto,
          gastado,
          neto: presupuesto - gastado,
        };
      }),
    [data]
  );

  const totals = useMemo(() => {
    const presupuesto = chartData.reduce(
      (sum, row) => sum + safeNum(row.presupuesto),
      0
    );
    const gastado = chartData.reduce((sum, row) => sum + safeNum(row.gastado), 0);

    return {
      presupuesto,
      gastado,
      neto: presupuesto - gastado,
    };
  }, [chartData]);

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      <div>
        <h3 style={{ color: "var(--heading)", fontWeight: 800, fontSize: 18 }}>
          Presupuesto vs Gasto Real
        </h3>
        <p className="mt-1" style={{ color: "var(--muted)", fontSize: 14 }}>
          Compara el presupuesto asignado con el gasto real por categoría.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[112px_180px_auto] lg:w-auto">
        <label>
          <span className="text-xs font-semibold uppercase text-[var(--muted)]">
            Ano
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={yearDraft}
            onChange={(event) => setYearDraft(event.target.value)}
            onKeyDown={onFilterKeyDown}
            min="2000"
            max="2100"
            className="ff-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
          />
        </label>

        <label>
          <span className="text-xs font-semibold uppercase text-[var(--muted)]">
            Mes
          </span>
          <FFSelect
            value={monthDraft}
            onChange={(value) => setMonthDraft(String(value))}
            options={MONTH_OPTIONS}
            placeholder="Selecciona mes"
            searchable={false}
            clearable={false}
            className="mt-1 w-full"
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
            disabled={loading}
          />
        </label>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || !token}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--primary) 16%, var(--panel))",
            color: "var(--text)",
          }}
          title="Refrescar reporte"
        >
          <HiRefresh className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refrescar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span style={{ color: "var(--muted)" }}>Periodo:</span>
        <strong style={{ color: "var(--text)" }}>{selectedPeriodLabel}</strong>
        {loading ? (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Actualizando...
          </span>
        ) : null}
      </div>

      {errorMsg ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 42%, var(--border-rgba))",
            background: "color-mix(in srgb, var(--danger) 10%, var(--panel))",
            color: "var(--text)",
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          label="Total presupuesto"
          value={money(totals.presupuesto)}
        />
        <SummaryCard
          label="Total gastado"
          value={money(totals.gastado)}
          tone={
            totals.gastado > totals.presupuesto && totals.presupuesto > 0
              ? "danger"
              : "neutral"
          }
        />
        <SummaryCard
          label="Neto"
          value={signedMoney(totals.neto)}
          tone={totals.neto >= 0 ? "success" : "danger"}
          helper={totals.neto >= 0 ? "Disponible" : "Sobre presupuesto"}
        />
      </div>

      {chartData.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, fontStyle: "italic" }}>
          {loading ? "Cargando reporte..." : "No hay datos disponibles."}
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid {...ui.grid} />

              <XAxis
                dataKey="category"
                stroke={ui.axisStroke}
                tick={ui.tick}
              />
              <YAxis stroke={ui.axisStroke} tick={ui.tick} />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "color-mix(in srgb, var(--text) 6%, transparent)" }}
              />

              <Legend
                wrapperStyle={ui.legendWrap}
                formatter={(value) => (
                  <span style={{ color: "var(--text)" }} className="text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />

              <Bar
                dataKey="presupuesto"
                fill={ui.budgetFill}
                name="Presupuesto"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="gastado"
                fill={ui.actualFill}
                name="Gastado"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default BudgetVsActualChart;
