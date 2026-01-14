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
  ReferenceLine,
} from "recharts";

function ProjectedVsActualExpenseByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/projected-vs-actual-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(Array.isArray(res.data?.data) ? res.data.data : []);
        setMeta(res.data?.meta ?? null);
      })
      .catch((err) =>
        console.error("Error cargando proyección vs realidad:", err)
      );
  }, [token, api]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(+v) ? +v : 0);

  const toNum = (x) => (Number.isFinite(+x) ? +x : 0);

  // Datos saneados + label + ordenados para lectura (ranking)
  const chartData = useMemo(() => {
    const rows = (Array.isArray(data) ? data : []).map((row) => {
      const projected = toNum(row.projected_monthly);
      const actual = toNum(row.actual_month_to_date);

      return {
        ...row,
        projected_monthly: projected,
        actual_month_to_date: actual,
        label: `${row.category ?? "Sin categoría"} (${row.stability_type ?? "n/a"})`,
        sortKey: Math.max(projected, actual),
      };
    });

    rows.sort((a, b) => b.sortKey - a.sortKey);
    return rows;
  }, [data]);

  // Layout vertical => necesitamos ancho de YAxis dinámico para labels largos
  const yAxisWidth = useMemo(() => {
    const maxLen = chartData.reduce((acc, r) => Math.max(acc, (r.label || "").length), 0);
    // Aproximación: 7px por carácter, clamp 140..320
    return Math.max(140, Math.min(320, Math.round(maxLen * 7)));
  }, [chartData]);

  // Altura dinámica para que no se "aplasten" las barras
  const chartHeight = useMemo(() => {
    const n = chartData.length;
    const base = 220; // espacio mínimo para ejes/leyenda
    const perRow = 26; // alto por barra (aprox)
    return Math.max(320, Math.min(920, base + n * perRow));
  }, [chartData]);

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Proyección vs realidad por categoría
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Compara lo proyectado (mediana histórica) con el gasto real del mes{" "}
          <span className="text-slate-200 font-medium">
            {meta?.month || ""}
          </span>
          . 
        </p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para este análisis.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 10, left: 10 }}
              barCategoryGap={8}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />

              {/* X = monto */}
              <XAxis
                type="number"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={(v) => formatCurrency(v)}
              />

              {/* Y = categorías */}
              <YAxis
                type="category"
                dataKey="label"
                width={yAxisWidth}
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />

              <ReferenceLine x={0} stroke="#334155" />

              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                }}
                formatter={(value, _name, item) => {
                  const key = item?.dataKey;
                  if (key === "projected_monthly")
                    return [formatCurrency(value), "Proyectado del mes"];
                  if (key === "actual_month_to_date")
                    return [formatCurrency(value), "Real gastado"];
                  return [formatCurrency(value), _name];
                }}
              />

              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(val) => (
                  <span className="text-slate-200 text-sm">{val}</span>
                )}
              />

              {/* ✅ Colores cambiados (antes índigo/naranja). Ahora: teal + fucsia */}
              <Bar
                dataKey="projected_monthly"
                name="Proyectado del mes"
                fill="#14b8a6"
                radius={[8, 8, 8, 8]}
              />
              <Bar
                dataKey="actual_month_to_date"
                name="Real gastado"
                fill="#f59e0b"
                radius={[8, 8, 8, 8]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Nota opcional de interpretación */}
      <div className="text-xs text-slate-500 leading-relaxed">
        Tip: Si el <span className="text-slate-300">Real (MTD)</span> va por encima del{" "}
        <span className="text-slate-300">Proyectado</span> temprano en el mes, puede ser
        señal de gasto acelerado (no necesariamente “fuera de control” si tus gastos son front-loaded).
      </div>
    </div>
  );
}

export default ProjectedVsActualExpenseByCategoryChart;
