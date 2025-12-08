import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "react-toastify";

const MAX_ITEMS = 20;

function ItemTrendChart({ token }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [trendData, setTrendData] = useState([]); // datos crudos por item/mes
  const [year, setYear] = useState(new Date().getFullYear());
  const [metric, setMetric] = useState("quantity"); // "quantity" | "total"

  const api = import.meta.env.VITE_API_URL;

  // Mapa id -> nombre para usar en la leyenda
  const itemNameMap = {};
  items.forEach((i) => {
    itemNameMap[String(i.id)] = i.name;
  });

  // 1) Cargar lista de artículos
  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar artículos:", err);
      });
  }, [token, api]);

  // 2) Cargar tendencias de consumo para los artículos seleccionados
  useEffect(() => {
    if (!token) return;

    if (selectedIds.length === 0) {
      setTrendData([]);
      return;
    }

    const requests = selectedIds.map((idStr) =>
      axios
        .get(`${api}/analytics/item-trend/${idStr}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { year },
        })
        .then((res) => ({
          item_id: idStr,
          rows: res.data.data || [],
        }))
    );

    Promise.all(requests)
      .then((results) => {
        const allEntries = [];

        results.forEach(({ item_id, rows }) => {
          rows.forEach((row) => {
            allEntries.push({
              ...row, // { month, quantity, total }
              item_id,
            });
          });
        });

        setTrendData(allEntries);
      })
      .catch((err) => {
        console.error("Error al cargar tendencia de artículos:", err);
      });
  }, [selectedIds, token, api, year]);

  // 3) Agrupar por mes para el gráfico
  const groupedByMonth = {};

  trendData.forEach((entry) => {
    const key = entry.month;
    if (!groupedByMonth[key]) groupedByMonth[key] = { month: key };

    const value =
      metric === "quantity"
        ? Number(entry.quantity ?? 0)
        : Number(entry.total ?? 0);

    groupedByMonth[key][entry.item_id] = value;
  });

  const chartData = Object.values(groupedByMonth).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // 4) Manejo de selección múltiple
  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_ITEMS) {
        toast.error(
          `Solo puedes seleccionar hasta ${MAX_ITEMS} artículos a la vez.`
        );
        return;
      }

      setSelectedIds([...selectedIds, idStr]);
    } else {
      setSelectedIds(selectedIds.filter((x) => x !== idStr));
    }
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleYearChange = (e) => {
    const value = e.target.value;
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setYear(num);
  };

  const formatTooltipValue = (value) => {
    if (metric === "total") {
      const num = typeof value === "number" ? value : Number(value ?? 0);
      return `RD$ ${num.toFixed(2)}`;
    }
    return value;
  };

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
    >
      <div>
        <h3 className="font-semibold mb-1 text-slate-100 text-lg">
          Tendencia de consumo por artículo
        </h3>
        <p className="text-sm text-slate-400">
          Analiza la evolución mensual de consumo por artículo, ya sea por
          cantidad o por monto total gastado.
        </p>
      </div>

      {/* Controles superiores: año + métrica */}
      <div className="flex flex-wrap items-center gap-4 mb-2 text-sm text-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Año:</span>
          <input
            type="number"
            value={year}
            onChange={handleYearChange}
            className="
              border border-slate-700 rounded-lg px-2 py-1 w-24 text-sm
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
            min="2000"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Métrica:</span>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="metric"
              value="quantity"
              checked={metric === "quantity"}
              onChange={() => setMetric("quantity")}
              className="accent-emerald-400"
            />
            <span className="text-slate-200">Cantidad</span>
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="metric"
              value="total"
              checked={metric === "total"}
              onChange={() => setMetric("total")}
              className="accent-emerald-400"
            />
            <span className="text-slate-200">Gasto total</span>
          </label>
        </div>
      </div>

      {/* Controles de selección múltiple */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs sm:text-sm text-slate-300">
            Máximo{" "}
            <span className="font-semibold text-emerald-300">
              {MAX_ITEMS}
            </span>{" "}
            artículos. Seleccionados:{" "}
            <span className="font-semibold text-slate-100">
              {selectedIds.length}/{MAX_ITEMS}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className={`
              text-xs sm:text-sm px-3 py-1.5 rounded-lg border
              transition-colors
              ${
                selectedIds.length === 0
                  ? "text-slate-600 border-slate-800 bg-slate-900 cursor-not-allowed"
                  : "text-slate-100 border-slate-600 bg-slate-900 hover:bg-slate-800"
              }
            `}
          >
            Desmarcar todos
          </button>
        </div>

        <div
          className="
            max-h-48 overflow-y-auto
            border border-slate-800 rounded-xl
            bg-slate-950/70
            p-2 space-y-1
          "
        >
          {items.length === 0 ? (
            <p className="text-xs text-slate-500">
              No hay artículos registrados.
            </p>
          ) : (
            items.map((item) => {
              const idStr = String(item.id);
              const checked = selectedIds.includes(idStr);
              return (
                <label
                  key={item.id}
                  className="
                    flex items-center gap-2
                    text-xs sm:text-sm
                    text-slate-200
                    cursor-pointer
                    hover:bg-slate-900/70
                    rounded-md px-2 py-1
                  "
                >
                  <input
                    type="checkbox"
                    className="form-checkbox accent-emerald-400"
                    value={idStr}
                    checked={checked}
                    onChange={handleCheckboxChange}
                  />
                  <span className="truncate">{item.name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length === 0 || selectedIds.length === 0 ? (
        <p className="text-sm text-slate-400">
          Selecciona uno o más artículos (hasta {MAX_ITEMS}) para ver su
          tendencia de consumo.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="month"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatTooltipValue(value)}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                  fontSize: "0.8rem",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />

              {selectedIds.map((id, index) => {
                const color = `hsl(${(index * 60) % 360}, 70%, 55%)`;
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stroke={color}
                    name={itemNameMap[id] || id}
                    connectNulls={true}
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      strokeWidth: 1,
                      stroke: "#020617",
                      fill: color,
                    }}
                    activeDot={{
                      r: 7,
                      strokeWidth: 2,
                      stroke: "#e5e7eb",
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ItemTrendChart;
