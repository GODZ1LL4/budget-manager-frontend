import { useEffect, useMemo, useState } from "react";
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

function formatCurrencyDOP(val) {
  const n = Number(val);
  return `RD$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function ItemPriceTrendChart({ token }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [search, setSearch] = useState("");

  const api = import.meta.env.VITE_API_URL;

  const MAX_ITEMS = 20;

  // Obtener lista de artículos
  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar artículos:", err);
        toast.error("No se pudieron cargar los artículos.");
      });
  }, [token, api]);

  // Obtener datos de precios históricos según selección
  useEffect(() => {
    if (!token) return;

    if (selectedIds.length === 0) {
      setPriceData([]);
      return;
    }

    axios
      .get(`${api}/analytics/item-prices-trend`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { item_ids: selectedIds },
      })
      .then((res) => setPriceData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar tendencia de precios:", err);
        toast.error("No se pudo cargar la tendencia de precios.");
      });
  }, [selectedIds, token, api]);

  // Filtrar items por búsqueda
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      String(it?.name || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  // Crear estructura para gráfico (por fecha)
  const groupedByDate = {};
  const itemNameMap = {};

  priceData.forEach((entry) => {
    const key = entry.date;
    if (!groupedByDate[key]) groupedByDate[key] = { date: key };

    groupedByDate[key][entry.item_id] = entry.price;
    itemNameMap[entry.item_id] = entry.item_name;
  });

  const chartData = Object.values(groupedByDate).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_ITEMS) {
        toast.error(`Solo puedes seleccionar hasta ${MAX_ITEMS} artículos a la vez.`);
        return;
      }

      setSelectedIds([...selectedIds, idStr]);
    } else {
      setSelectedIds(selectedIds.filter((x) => x !== idStr));
    }
  };

  const handleClearAll = () => setSelectedIds([]);

  // ===== Recharts token styles =====
  const gridStroke = "color-mix(in srgb, var(--border-rgba) 55%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 55%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";

  const tooltipStyles = useMemo(
    () => ({
      background: "var(--panel)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "0.75rem",
      boxShadow: "var(--glow-shadow)",
      fontSize: "0.95rem",
    }),
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
      <div>
        <h3 className="text-xl font-semibold text-[var(--text)]">
          Tendencia de precios por artículo
        </h3>
        <p className="text-sm mt-1 text-[color-mix(in srgb,var(--text)_70%,transparent)]">
          Selecciona uno o más artículos para ver cómo han variado sus precios en el tiempo.
        </p>
      </div>

      {/* Controles de selección */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs sm:text-sm text-[color-mix(in srgb,var(--text)_75%,transparent)]">
            Máximo{" "}
            <span
              className="font-semibold"
              style={{ color: "color-mix(in srgb, var(--primary) 85%, var(--text))" }}
            >
              {MAX_ITEMS}
            </span>{" "}
            artículos. Seleccionados:{" "}
            <span className="font-semibold text-[var(--text)]">
              {selectedIds.length}/{MAX_ITEMS}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className="ff-btn text-xs sm:text-sm px-3 py-1.5 rounded-lg disabled:opacity-60"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 55%, transparent)",
              color: "var(--text)",
            }}
          >
            Desmarcar todos
          </button>
        </div>

        {/* Buscador */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs mb-1 block text-[color-mix(in srgb,var(--text)_70%,transparent)]">
              Buscar artículo
            </label>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ej. arroz, leche, detergente..."
                className="ff-input w-full pr-10"
              />

              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs"
                  style={{
                    border: "1px solid var(--border-rgba)",
                    background: "color-mix(in srgb, var(--panel) 60%, transparent)",
                    color: "color-mix(in srgb, var(--text) 85%, transparent)",
                  }}
                  aria-label="Limpiar búsqueda"
                  title="Limpiar"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div
          className="max-h-48 overflow-y-auto rounded-xl p-2 space-y-1 border"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 55%, transparent)",
          }}
        >
          {items.length === 0 ? (
            <p className="text-xs text-[color-mix(in srgb,var(--text)_60%,transparent)]">
              No hay artículos registrados.
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-[color-mix(in srgb,var(--text)_60%,transparent)]">
              No hay resultados para “{search.trim()}”.
            </p>
          ) : (
            filteredItems.map((item) => {
              const idStr = String(item.id);
              const checked = selectedIds.includes(idStr);

              return (
                <label
                  key={item.id}
                  className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer rounded-md px-2 py-1"
                  style={{
                    color: "color-mix(in srgb, var(--text) 88%, transparent)",
                    background: checked
                      ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    value={idStr}
                    checked={checked}
                    onChange={handleCheckboxChange}
                    className="accent-[var(--primary)]"
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
        <p className="text-sm text-[color-mix(in srgb,var(--text)_70%,transparent)]">
          Selecciona uno o más artículos (hasta {MAX_ITEMS}) para ver su tendencia de precios.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                dataKey="date"
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 13 }}
              />

              <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 13 }} />

              <Tooltip
                formatter={(value) => formatCurrencyDOP(value)}
                contentStyle={tooltipStyles}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text)", fontWeight: 800 }}
                cursor={{ fill: "color-mix(in srgb, var(--text) 6%, transparent)" }}
              />

              <Legend
                wrapperStyle={legendStyle}
                formatter={(value) => (
                  <span className="text-xs sm:text-sm text-[color-mix(in srgb,var(--text)_85%,transparent)]">
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
                      stroke: "var(--bg-1)",
                      fill: color,
                    }}
                    activeDot={{
                      r: 7,
                      strokeWidth: 2,
                      stroke: "var(--text)",
                    }}
                    isAnimationActive={false}
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

export default ItemPriceTrendChart;
