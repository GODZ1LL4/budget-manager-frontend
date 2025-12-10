import { useEffect, useState } from "react";
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

const colorMap = {
  fixed: "#10b981",
  variable: "#6366f1",
};

const formatMoney = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  return `RD$ ${num.toFixed(2)}`;
};

// Label adaptable
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
      fill="#e5e7eb"
      fontSize={13}
      fontWeight={600}
      textAnchor={isInside ? "end" : "start"}
      dominantBaseline="middle"   // 👈 Asegura centro vertical
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

  // Ancho del eje Y según texto más largo
  const yAxisWidth = Math.min(
    200,
    Math.max(
      100,
      Math.max(...filteredData.map((d) => d.category.length)) * 6
    )
  );

  // Altura dinámica según cantidad de barras
  const chartHeight = Math.max(
    260,
    60 + filteredData.length * 35
  );

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-5
      "
    >
      {/* Título */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Gastos proyectados por categoría
          </h3>
          <p className="text-sm text-slate-400">
            Proyección mensual de gasto por categoría, diferenciando gastos fijos y variables.
          </p>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="
            text-sm rounded-lg px-3 py-1.5
            bg-slate-900 border border-slate-700 text-slate-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500
          "
        >
          <option value="all">Todos</option>
          <option value="fixed">Fijos</option>
          <option value="variable">Variables</option>
        </select>
      </div>

      {/* RESUMEN DE TOTALES */}
      {filteredData.length > 0 && (
        <div
          className="
            text-sm text-slate-200 bg-slate-900/60 border border-slate-700
            rounded-xl px-4 py-2 flex flex-wrap gap-4
          "
        >
          {filter === "all" ? (
            <>
              <span>
                <span className="text-slate-400">Fijos:</span>{" "}
                <span className="font-semibold">{formatMoney(totals.fixed)}</span>
              </span>
              <span>
                <span className="text-slate-400">Variables:</span>{" "}
                <span className="font-semibold">{formatMoney(totals.variable)}</span>
              </span>

              <span className="font-semibold ml-auto">
                Total general:{" "}
                <span className="text-emerald-400">
                  {formatMoney(totals.general)}
                </span>
              </span>
            </>
          ) : (
            <span className="capitalize">
              Total {filter}:{" "}
              <span className="font-semibold text-emerald-400">
                {formatMoney(filter === "fixed" ? totals.fixed : totals.variable)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* GRAFICO */}
      {filteredData.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No hay datos para los filtros seleccionados.</p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer>
            <BarChart
              data={filteredData}
              layout="vertical"
              margin={{ top: 10, right: 50, bottom: 20, left: 10 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />

              <XAxis
                type="number"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />

              <YAxis
                type="category"
                dataKey="category"
                width={yAxisWidth}
                tick={{ fill: "#e5e7eb", fontSize: 13 }}
              />

              <Tooltip
                formatter={(val) => formatMoney(val)}
                labelFormatter={(l) => `Categoría: ${l}`}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                  fontSize: "0.9rem",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
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
                {filteredData.map((item, i) => (
                  <Cell
                    key={i}
                    fill={colorMap[item.stability_type] || "#d1d5db"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ProjectedExpenseByCategoryChart;
