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

    // Pedimos cada item por separado: /analytics/item-trend/:id?year=YYYY
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
            // row tiene: { month, quantity, total } según tu backend actual
            allEntries.push({
              ...row,
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

  // 4) Manejo de selección múltiple (igual que ItemPriceTrendChart)
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
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">
        Tendencia de consumo por artículo
      </h3>

      {/* Controles superiores: año + métrica */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Año:</span>
          <input
            type="number"
            value={year}
            onChange={handleYearChange}
            className="border border-gray-300 rounded px-2 py-1 w-24 text-sm"
            min="2000"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Métrica:</span>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="metric"
              value="quantity"
              checked={metric === "quantity"}
              onChange={() => setMetric("quantity")}
            />
            <span>Cantidad</span>
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="metric"
              value="total"
              checked={metric === "total"}
              onChange={() => setMetric("total")}
            />
            <span>Gasto total</span>
          </label>
        </div>
      </div>

      {/* Controles de selección múltiple */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs sm:text-sm text-gray-700">
            Máximo{" "}
            <span className="font-semibold">{MAX_ITEMS}</span> artículos.
            Seleccionados:{" "}
            <span className="font-semibold">
              {selectedIds.length}/{MAX_ITEMS}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className={`text-xs sm:text-sm px-2 py-1 rounded border ${
              selectedIds.length === 0
                ? "text-gray-400 border-gray-200 cursor-not-allowed"
                : "text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            Desmarcar todos
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-gray-500">
              No hay artículos registrados.
            </p>
          ) : (
            items.map((item) => {
              const idStr = String(item.id);
              const checked = selectedIds.includes(idStr);
              return (
                <label
                  key={item.id}
                  className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="form-checkbox"
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
        <p className="text-sm text-gray-500">
          Selecciona uno o más artículos (hasta {MAX_ITEMS}) para ver su
          tendencia de consumo.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => formatTooltipValue(value)} />
            <Legend />
            {selectedIds.map((id, index) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={`hsl(${(index * 60) % 360}, 70%, 50%)`}
                name={itemNameMap[id] || id}
                dot={false}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default ItemTrendChart;
