import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* ================= Tokens / Utils ================= */

const formatMoney = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  return `RD$ ${num.toFixed(2)}`;
};

function toneTokenFromStability(stabilityType) {
  // ingresos: fijo = success, variable = primary
  return stabilityType === "fixed"
    ? "var(--success)"
    : stabilityType === "variable"
    ? "var(--primary)"
    : "var(--text)";
}

function ProjectedIncomeByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("all");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/projected-income-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const incoming = res?.data?.data || [];
        setData(incoming);
        setFilteredData(incoming);
      })
      .catch((err) =>
        console.error("❌ Error al cargar ingresos proyectados:", err)
      );
  }, [token, api]);

  useEffect(() => {
    if (filter === "all") {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter((item) => item.stability_type === filter));
    }
  }, [filter, data]);

  // ===== Recharts styles tokenizados =====
  const gridStroke = "color-mix(in srgb, var(--border-rgba) 55%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 55%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";

  const tooltipStyles = useMemo(
    () => ({
      backgroundColor: "var(--panel)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "0.75rem",
      boxShadow: "var(--glow-shadow)",
      fontSize: "1rem",
    }),
    []
  );

  const tooltipItemStyle = useMemo(() => ({ color: "var(--text)" }), []);
  const tooltipLabelStyle = useMemo(
    () => ({ color: "var(--text)", fontWeight: 700 }),
    []
  );

  const legendStyle = useMemo(
    () => ({ color: "color-mix(in srgb, var(--text) 85%, transparent)" }),
    []
  );

  return (
    <div
      className="rounded-2xl p-6 space-y-4 border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom right, var(--bg-1), color-mix(in srgb, var(--panel) 45%, transparent), var(--bg-1))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
      }}
    >
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-[var(--text)]">
            Ingresos proyectados por categoría
          </h3>
          <p className="text-sm mt-1 text-[color-mix(in srgb,var(--text)_70%,transparent)]">
            Proyección mensual de ingresos por categoría, diferenciando ingresos
            fijos y variables.
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

      {filteredData.length === 0 ? (
        <p className="text-sm italic text-[color-mix(in srgb,var(--text)_60%,transparent)]">
          No hay datos de ingresos proyectados para los filtros seleccionados.
        </p>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer>
            <BarChart
              data={filteredData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 80, bottom: 20 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                type="number"
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 11 }}
              />

              <YAxis
                type="category"
                dataKey="category"
                width={140}
                tick={{ fill: "var(--text)", fontSize: 12 }}
                stroke={axisStroke}
              />

              <Tooltip
                formatter={(val) => formatMoney(val)}
                labelFormatter={(label) => `Categoría: ${label}`}
                contentStyle={tooltipStyles}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />

              <Legend
                wrapperStyle={legendStyle}
                formatter={(value) => (
                  <span className="text-xs sm:text-sm text-[color-mix(in srgb,var(--text)_85%,transparent)]">
                    {value}
                  </span>
                )}
              />

              <Bar
                dataKey="projected_monthly"
                name="Proyección mensual"
                isAnimationActive={false}
                radius={[4, 4, 4, 4]}
              >
                {filteredData.map((entry, index) => {
                  const token = toneTokenFromStability(entry.stability_type);
                  return (
                    <Cell
                      key={`cell-${index}`}
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

export default ProjectedIncomeByCategoryChart;
