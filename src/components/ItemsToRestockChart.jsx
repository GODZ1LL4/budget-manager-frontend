import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";

function ItemsToRestockChart({ token }) {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(3);
  const [minAvgQty, setMinAvgQty] = useState(1);
  const [nextMonthLabel, setNextMonthLabel] = useState("");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(
        `${api}/analytics/items-to-restock?months=${months}&min_avg_qty=${minAvgQty}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      .then((res) => {
        const payload = res.data || {};
        setData(payload.data || []);
        setNextMonthLabel(payload.meta?.next_month || "");
      })
      .catch((err) => {
        console.error("Error al cargar items a recomprar", err);
      });
  }, [token, months, minAvgQty, api]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">
        Artículos a recomprar — proyección {nextMonthLabel || "próximo mes"}
      </h3>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            Meses a considerar:
          </label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
            className="border border-gray-300 rounded p-1 w-20"
            min="1"
            max="12"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            Mínimo promedio (cantidad):
          </label>
          <input
            type="number"
            value={minAvgQty}
            step="0.5"
            onChange={(e) => setMinAvgQty(Math.max(0, Number(e.target.value) || 0))}
            className="border border-gray-300 rounded p-1 w-24"
            min="0"
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 80, right: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            dataKey="item_name"
            type="category"
            width={140}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(v, name, props) => {
              if (name === "projected_next_month_cost") {
                return [`RD$ ${v.toFixed(2)}`, "Costo proyectado"];
              }
              if (name === "projected_next_month_qty") {
                return [`${v.toFixed(2)} uds`, "Cantidad proyectada"];
              }
              return [v, name];
            }}
            labelFormatter={(label) => `Artículo: ${label}`}
          />
          <Bar
            dataKey="projected_next_month_cost"
            name="Costo proyectado"
          >
            <LabelList
              dataKey="projected_next_month_qty"
              position="right"
              formatter={(v) => `${v.toFixed(1)} uds`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {data.length === 0 && (
        <p className="text-sm text-gray-500 mt-3">
          No se encontraron artículos con el criterio actual.
        </p>
      )}
    </div>
  );
}

export default ItemsToRestockChart;
