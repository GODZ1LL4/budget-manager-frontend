import { useEffect, useMemo, useState } from "react";
import axios from "axios";
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
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/budget-vs-actual`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar presupuesto vs real:", err);
      });
  }, [token, api]);

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
          No hay datos disponibles.
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
