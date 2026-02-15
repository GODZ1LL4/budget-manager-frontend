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
  Cell,
  LabelList,
} from "recharts";

/* ================= Tokens / Utils ================= */

const formatMoney = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  return `RD$ ${num.toFixed(2)}`;
};

function toneTokenFromStability(stabilityType) {
  // fijo = success, variable = primary (ajústalo si quieres variable=warning)
  return stabilityType === "fixed"
    ? "var(--success)"
    : stabilityType === "variable"
    ? "var(--primary)"
    : "var(--text)";
}

// Label adaptable (tokenizado)
const CustomRightLabel = (props) => {
  const { x, y, width, height, value } = props;
  if (value == null) return null;

  const label = formatMoney(value);

  const padding = 8;

  // Centro vertical exacto de la barra
  const textY = y + height / 2;

  // Posiciones horizontales según si cabe dentro o no
  const minInsideWidth = 90;
  const insideX = x + width - padding;
  const outsideX = x + width + padding;

  const isInside = width >= minInsideWidth;

  return (
    <text
      x={isInside ? insideX : outsideX}
      y={textY}
      fill="var(--text)"
      fontSize={13}
      fontWeight={600}
      textAnchor={isInside ? "end" : "start"}
      dominantBaseline="middle"
    >
      {label}
    </text>
  );
};

function ProjectedExpenseByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("all");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/projected-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const incoming = res?.data?.data || [];
        setData(incoming);
        setFilteredData(incoming);
      })
      .catch((err) =>
        console.error("❌ Error al cargar gastos proyectados:", err)
      );
  }, [token, api]);

  useEffect(() => {
    if (filter === "all") {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter((i) => i.stability_type === filter));
    }
  }, [filter, data]);

  // ==== Totales ====
  const totals = filteredData.reduce(
    (acc, row) => {
      const val = Number(row.projected_monthly || 0);
      acc[row.stability_type] = (acc[row.stability_type] || 0) + val;
      acc.general += val;
      return acc;
    },
    { fixed: 0, variable: 0, general: 0 }
  );

  // ==== Tamaños dinámicos ====
  const yAxisWidth = useMemo(() => {
    if (!filteredData.length) return 120;
    return Math.min(
      220,
      Math.max(
        110,
        Math.max(...filteredData.map((d) => String(d.category || "").length)) * 6
      )
    );
  }, [filteredData]);

  const chartHeight = useMemo(
    () => Math.max(260, 60 + filteredData.length * 35),
    [filteredData.length]
  );

  // ===== Recharts styles tokenizados =====
  const gridStroke = "color-mix(in srgb, var(--border-rgba) 55%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 55%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";

  const tooltipStyles = {
    backgroundColor: "var(--panel)",
    border: "1px solid var(--border-rgba)",
    color: "var(--text)",
    borderRadius: "0.75rem",
    boxShadow: "var(--glow-shadow)",
    fontSize: "0.9rem",
  };

  const tooltipItemStyle = { color: "var(--text)" };
  const tooltipLabelStyle = { color: "var(--text)", fontWeight: 700 };

  return (
    <div
      className="rounded-2xl p-6 space-y-5 border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom right, var(--bg-1), color-mix(in srgb, var(--panel) 45%, transparent), var(--bg-1))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
      }}
    >
      {/* Título */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-[var(--text)]">
            Gastos proyectados por categoría
          </h3>
          <p className="text-sm text-[color-mix(in srgb,var(--text)_70%,transparent)]">
            Proyección mensual de gasto por categoría, diferenciando gastos fijos
            y variables.
          </p>
        </div>

        {/* Usa tu select custom si quieres: <FFSelect .../> */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ff-input text-sm rounded-lg px-3 py-1.5"
        >
          <option value="all">Todos</option>
          <option value="fixed">Fijos</option>
          <option value="variable">Variables</option>
        </select>
      </div>

      {/* RESUMEN DE TOTALES */}
      {filteredData.length > 0 && (
        <div
          className="text-sm rounded-xl px-4 py-2 flex flex-wrap gap-4 border"
          style={{
            color: "color-mix(in srgb, var(--text) 88%, transparent)",
            background: "color-mix(in srgb, var(--panel) 55%, transparent)",
            borderColor: "var(--border-rgba)",
          }}
        >
          {filter === "all" ? (
            <>
              <span>
                <span className="text-[color-mix(in srgb,var(--text)_65%,transparent)]">
                  Fijos:
                </span>{" "}
                <span className="font-semibold">{formatMoney(totals.fixed)}</span>
              </span>
              <span>
                <span className="text-[color-mix(in srgb,var(--text)_65%,transparent)]">
                  Variables:
                </span>{" "}
                <span className="font-semibold">
                  {formatMoney(totals.variable)}
                </span>
              </span>

              <span className="font-semibold ml-auto">
                Total general:{" "}
                <span
                  style={{
                    color:
                      "color-mix(in srgb, var(--success) 88%, var(--text))",
                  }}
                >
                  {formatMoney(totals.general)}
                </span>
              </span>
            </>
          ) : (
            <span className="capitalize">
              Total {filter}:{" "}
              <span
                className="font-semibold"
                style={{
                  color:
                    "color-mix(in srgb, var(--success) 88%, var(--text))",
                }}
              >
                {formatMoney(
                  filter === "fixed" ? totals.fixed : totals.variable
                )}
              </span>
            </span>
          )}
        </div>
      )}

      {/* GRAFICO */}
      {filteredData.length === 0 ? (
        <p className="text-sm italic text-[color-mix(in srgb,var(--text)_60%,transparent)]">
          No hay datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer>
            <BarChart
              data={filteredData}
              layout="vertical"
              margin={{ top: 10, right: 50, bottom: 20, left: 10 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                type="number"
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 12 }}
              />

              <YAxis
                type="category"
                dataKey="category"
                width={yAxisWidth}
                tick={{ fill: "var(--text)", fontSize: 13 }}
                stroke={axisStroke}
              />

              <Tooltip
                formatter={(val) => formatMoney(val)}
                labelFormatter={(l) => `Categoría: ${l}`}
                contentStyle={tooltipStyles}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />

              <Bar
                dataKey="projected_monthly"
                name="Proyección mensual"
                radius={[4, 4, 4, 4]}
              >
                <LabelList
                  dataKey="projected_monthly"
                  content={<CustomRightLabel />}
                />
                {filteredData.map((item, i) => {
                  const token = toneTokenFromStability(item.stability_type);
                  return (
                    <Cell
                      key={i}
                      fill={`color-mix(in srgb, ${token} 85%, transparent)`}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ProjectedExpenseByCategoryChart;
