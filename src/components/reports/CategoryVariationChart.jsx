import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "react-toastify";

function formatCurrencyDOP(val) {
  const n = Number(val);
  return `RD$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function CategoryVariationChart({ token, categories = [] }) {
  const api = import.meta.env.VITE_API_URL;

  const MAX_CATEGORIES = 20;

  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState("");

  const [data, setData] = useState({}); // { [category_id]: [{ month, amount }, ...] }
  const [selectedIds, setSelectedIds] = useState([]); // ids seleccionadas

  // Solo categorías expense
  const expenseCategories = useMemo(
    () => (categories || []).filter((cat) => cat.type === "expense"),
    [categories]
  );

  // Buscador (filtra lista)
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenseCategories;
    return expenseCategories.filter((c) =>
      String(c.name || "")
        .toLowerCase()
        .includes(q)
    );
  }, [expenseCategories, search]);

  // Meses del año seleccionado
  const allMonths = useMemo(() => {
    const y = Number(year) || currentYear;
    return Array.from(
      { length: 12 },
      (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`
    );
  }, [year, currentYear]);

  useEffect(() => {
    if (!token) return;

    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) return;

    axios
      .get(`${api}/analytics/yearly-category-variations`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: y },
      })
      .then((res) => {
        const incoming = res.data?.data || {};
        setData(incoming);

        // ✅ Si cambiaste el año, elimina seleccionadas que no existen en este dataset
        setSelectedIds((prev) => prev.filter((id) => incoming[id] != null));
      })

      .catch((err) => {
        console.error(
          "Error al cargar variaciones anuales por categoría:",
          err
        );
        toast.error("No se pudo cargar la variación anual por categoría.");
      });
  }, [token, api, year]);

  // Armar data para el gráfico
  const chartData =
    selectedIds.length === 0
      ? []
      : allMonths.map((month) => {
          const row = { month };
          selectedIds.forEach((catId) => {
            const entries = data[catId] || [];
            const found = entries.find((e) => e.month === month);
            row[catId] = found ? found.amount : 0;
          });
          return row;
        });

  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_CATEGORIES) {
        toast.error(
          `Solo puedes seleccionar hasta ${MAX_CATEGORIES} categorías a la vez.`
        );
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
      borderRadius: "0.75rem",
      boxShadow: "var(--glow-shadow)",
      color: "var(--text)",
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
      {/* Header + controls */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-[var(--text)]">
            Variación de gastos por categoría (anual)
          </h3>
          <p className="text-sm mt-1 text-[color-mix(in srgb,var(--text)_70%,transparent)]">
            Analiza cómo varía el gasto mensual por categoría a lo largo del año
            seleccionado.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          {/* Año */}
          <div className="min-w-[140px]">
            <label className="text-xs mb-1 block text-[color-mix(in srgb,var(--text)_70%,transparent)]">
              Año
            </label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="ff-input w-full"
            />
          </div>

          {/* Buscador */}
          <div className="min-w-[220px] flex-1">
            <label className="text-xs mb-1 block text-[color-mix(in srgb,var(--text)_70%,transparent)]">
              Buscar categoría
            </label>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ej. supermercado, renta..."
                className="ff-input w-full pr-10"
              />

              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs"
                  style={{
                    border: "1px solid var(--border-rgba)",
                    background:
                      "color-mix(in srgb, var(--panel) 60%, transparent)",
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
      </div>

      {/* Controles de selección */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs sm:text-sm text-[color-mix(in srgb,var(--text)_75%,transparent)]">
            Máximo{" "}
            <span
              className="font-semibold"
              style={{
                color: "color-mix(in srgb, var(--primary) 85%, var(--text))",
              }}
            >
              {MAX_CATEGORIES}
            </span>{" "}
            categorías. Seleccionadas:{" "}
            <span className="font-semibold text-[var(--text)]">
              {selectedIds.length}/{MAX_CATEGORIES}
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

        <div
          className="max-h-48 overflow-y-auto rounded-xl p-2 space-y-1 border"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 55%, transparent)",
          }}
        >
          {expenseCategories.length === 0 ? (
            <p className="text-xs text-[color-mix(in srgb,var(--text)_60%,transparent)]">
              No hay categorías de gasto registradas.
            </p>
          ) : filteredCategories.length === 0 ? (
            <p className="text-xs text-[color-mix(in srgb,var(--text)_60%,transparent)]">
              No hay resultados para “{search.trim()}”.
            </p>
          ) : (
            filteredCategories.map((cat) => {
              const idStr = String(cat.id);
              const checked = selectedIds.includes(idStr);

              return (
                <label
                  key={cat.id}
                  className="
                    flex items-center gap-2
                    text-xs sm:text-sm
                    cursor-pointer
                    rounded-md px-2 py-1
                  "
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
                  <span className="truncate">{cat.name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length === 0 || selectedIds.length === 0 ? (
        <p className="text-sm text-[color-mix(in srgb,var(--text)_70%,transparent)]">
          Selecciona una o varias categorías de gasto (hasta {MAX_CATEGORIES})
          para ver su variación mensual.
        </p>
      ) : (
        <div className="w-full h-[320px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
              <XAxis
                dataKey="month"
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 13 }}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 13 }}
              />

              <Tooltip
                formatter={(value) => formatCurrencyDOP(value)}
                contentStyle={tooltipStyles}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text)", fontWeight: 800 }}
                cursor={{
                  fill: "color-mix(in srgb, var(--text) 6%, transparent)",
                }}
              />

              <Legend
                wrapperStyle={legendStyle}
                formatter={(value) => (
                  <span className="text-xs sm:text-sm text-[color-mix(in srgb,var(--text)_85%,transparent)]">
                    {value}
                  </span>
                )}
              />

              {selectedIds.map((catId, index) => {
                const cat = expenseCategories.find(
                  (c) => String(c.id) === String(catId)
                );

                // Mantenemos tu color HSL por serie (está bien para N categorías)
                const color = `hsl(${(index * 60) % 360}, 70%, 55%)`;

                return (
                  <Line
                    key={catId}
                    type="monotone"
                    dataKey={catId}
                    stroke={color}
                    name={cat?.name || catId}
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

export default CategoryVariationChart;
