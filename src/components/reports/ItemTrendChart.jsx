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

const MAX_ITEMS = 20;
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const normalizeMonth = (m) => {
  if (m == null) return null;

  const s = String(m).trim();

  // YYYY-MM o YYYY-M
  const match = s.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const yy = match[1];
    const mm = String(Number(match[2])).padStart(2, "0");
    return `${yy}-${mm}`;
  }

  // YYYY/MM o variantes
  const match2 = s.match(/^(\d{4})[/-](\d{1,2})/);
  if (match2) {
    const yy = match2[1];
    const mm = String(Number(match2[2])).padStart(2, "0");
    return `${yy}-${mm}`;
  }

  return null;
};

function ItemTrendChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [trendData, setTrendData] = useState([]); // {month, quantity, total, item_id}
  const [year, setYear] = useState(new Date().getFullYear());
  const [metric, setMetric] = useState("quantity"); // "quantity" | "total"
  const [search, setSearch] = useState("");

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const itemNameMap = useMemo(() => {
    const m = {};
    (items || []).forEach((i) => {
      m[String(i.id)] = i.name;
    });
    return m;
  }, [items]);

  const formatCurrency = useMemo(() => {
    const nf = new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    });
    return (v) => nf.format(toNum(v));
  }, []);

  const formatTooltipValue = (value) => {
    if (metric === "total") return formatCurrency(value);
    return toNum(value);
  };

  // ✅ palette tokenizada (si hay más de 4 series, cae a HSL)
  const getSeriesColor = (index) => {
    const vars = [
      "var(--primary)",
      "var(--success)",
      "var(--warning)",
      "var(--danger)",
    ];
    if (index < vars.length) return vars[index];
    return `hsl(${(index * 55) % 360} 70% 55%)`;
  };

  // 1) Lista de artículos
  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/items`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setItems(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar artículos:", err);
        toast.error("No se pudieron cargar los artículos.");
      });
  }, [token, api]);

  // 2) Tendencias por item seleccionado (paralelo) + ✅ anti-mezcla por año
  useEffect(() => {
    if (!token) return;

    if (selectedIds.length === 0) {
      setTrendData([]);
      return;
    }

    // ✅ limpia al cambiar year/selección para evitar “mezcla visual”
    setTrendData([]);

    let cancelled = false;

    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) return;

    const requests = selectedIds.map((idStr) =>
      axios
        .get(`${api}/analytics/item-trend/${idStr}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { year: y },
        })
        .then((res) => ({ item_id: idStr, rows: res.data?.data || [] }))
    );

    Promise.all(requests)
      .then((results) => {
        if (cancelled) return;

        const allEntries = [];
        results.forEach(({ item_id, rows }) => {
          rows.forEach((row) => allEntries.push({ ...row, item_id }));
        });

        setTrendData(allEntries);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error al cargar tendencia:", err);
        toast.error("No se pudo cargar la tendencia.");
      });

    return () => {
      cancelled = true; // ✅ ignora respuestas viejas
    };
  }, [selectedIds, token, api, year]);

  // 3) Chart data (agrupado por mes) + ✅ filtro por año
  const chartData = useMemo(() => {
    const grouped = {};
    const y = String(year);

    (trendData || []).forEach((entry) => {
      const key = normalizeMonth(entry.month);
      if (!key) return;
      if (!key.startsWith(`${y}-`)) return; // ✅ evita meses de otro año

      if (!grouped[key]) grouped[key] = { month: key };

      const value =
        metric === "quantity" ? toNum(entry.quantity) : toNum(entry.total);

      grouped[key][String(entry.item_id)] = value;
    });

    return Object.values(grouped).sort((a, b) =>
      String(a.month).localeCompare(String(b.month))
    );
  }, [trendData, metric, year]);

  // selección múltiple
  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_ITEMS) {
        toast.error(`Solo puedes seleccionar hasta ${MAX_ITEMS} artículos.`);
        return;
      }

      setSelectedIds((prev) => [...prev, idStr]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== idStr));
    }
  };

  const handleClearAll = () => setSelectedIds([]);

  const monthTick = (m) => {
    const key = normalizeMonth(m);
    return key ? key.slice(5, 7) : "—";
  };

  // ✅ Buscador: filtra items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((it) =>
      String(it?.name || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  // ✅ estilos tokenizados (tokens reales)
  const panelStyle = {
    background:
      "linear-gradient(135deg, var(--bg-1), color-mix(in srgb, var(--panel) 45%, transparent), var(--bg-1))",
    border: `var(--border-w) solid var(--border-rgba)`,
    borderRadius: "var(--radius-lg)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
  };

  const selectStyle = {
    background: "color-mix(in srgb, var(--panel) 70%, transparent)",
    color: "var(--text)",
    border: `var(--border-w) solid var(--border-rgba)`,
    borderRadius: "var(--radius-md)",
  };

  const chipWrapStyle = {
    background: "color-mix(in srgb, var(--panel) 60%, transparent)",
    border: `var(--border-w) solid var(--border-rgba)`,
    borderRadius: "var(--radius-md)",
  };

  const chipActiveStyle = {
    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
  };

  const chipIdleStyle = {
    borderRadius: "var(--radius-sm)",
    color: "var(--muted)",
  };

  const listBoxStyle = {
    background: "color-mix(in srgb, var(--panel) 55%, transparent)",
    border: `var(--border-w) solid var(--border-rgba)`,
    borderRadius: "var(--radius-md)",
  };

  const tooltipStyle = {
    backgroundColor: "var(--panel)",
    border: `var(--border-w) solid var(--border-rgba)`,
    color: "var(--text)",
    borderRadius: "12px",
    boxShadow: "var(--glow-shadow)",
    fontSize: "0.85rem",
  };

  const gridStroke = "color-mix(in srgb, var(--border-rgba) 55%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 55%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";

  const legendStyle = {
    color: "color-mix(in srgb, var(--text) 85%, transparent)",
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={panelStyle}>
      <div>
        <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
          Tendencia de consumo por artículo
        </h3>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Analiza la evolución mensual de consumo por artículo, por cantidad o por monto gastado.
        </p>
      </div>

      {/* Controles superiores */}
      <div className="flex flex-wrap items-end gap-4 text-sm">
        {/* Año */}
        <div className="flex flex-col">
          <label
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "color-mix(in srgb,var(--text)_70%,transparent)" }}
          >
            Año
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 px-3 py-2 text-sm focus:outline-none"
            style={selectStyle}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Métrica */}
        <div className="flex flex-col">
          <label
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "color-mix(in srgb,var(--text)_70%,transparent)" }}
          >
            Métrica
          </label>

          <div className="mt-1 inline-flex p-1" style={chipWrapStyle}>
            <button
              type="button"
              onClick={() => setMetric("quantity")}
              className="px-3 py-1.5 text-xs transition"
              style={metric === "quantity" ? chipActiveStyle : chipIdleStyle}
            >
              Cantidad
            </button>

            <button
              type="button"
              onClick={() => setMetric("total")}
              className="px-3 py-1.5 text-xs transition"
              style={metric === "total" ? chipActiveStyle : chipIdleStyle}
            >
              Gasto total
            </button>
          </div>
        </div>
      </div>

      {/* Selección múltiple */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs sm:text-sm" style={{ color: "var(--muted)" }}>
            Máximo{" "}
            <span className="font-semibold" style={{ color: "var(--success)" }}>
              {MAX_ITEMS}
            </span>{" "}
            artículos. Seleccionados:{" "}
            <span className="font-semibold" style={{ color: "var(--text)" }}>
              {selectedIds.length}/{MAX_ITEMS}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border transition disabled:opacity-60"
            style={{
              border: `var(--border-w) solid var(--border-rgba)`,
              background: "color-mix(in srgb, var(--panel) 60%, transparent)",
              color: "var(--text)",
            }}
          >
            Desmarcar todos
          </button>
        </div>

        {/* Buscador */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 min-w-[220px]">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "color-mix(in srgb,var(--text)_70%,transparent)" }}
            >
              Buscar artículo
            </label>

            <div className="relative mt-1">
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

        <div className="max-h-48 overflow-y-auto p-2 space-y-1" style={listBoxStyle}>
          {items.length === 0 ? (
            <p className="text-xs" style={{ color: "color-mix(in srgb,var(--text)_60%,transparent)" }}>
              No hay artículos registrados.
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs" style={{ color: "color-mix(in srgb,var(--text)_60%,transparent)" }}>
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
                    color: "var(--text)",
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

      {/* Chart */}
      {chartData.length === 0 || selectedIds.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Selecciona uno o más artículos (hasta {MAX_ITEMS}) para ver la tendencia.
        </p>
      ) : (
        <div className="w-full h-[320px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                dataKey="month"
                tickFormatter={monthTick}
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 12 }}
              />

              <YAxis
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 12 }}
                tickFormatter={(v) => (metric === "total" ? formatCurrency(v) : v)}
              />

              <Tooltip
                formatter={(value) => formatTooltipValue(value)}
                contentStyle={tooltipStyle}
                cursor={{ fill: "color-mix(in srgb, var(--text) 6%, transparent)" }}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text)", fontWeight: 700 }}
              />

              <Legend
                wrapperStyle={legendStyle}
                formatter={(value) => (
                  <span
                    className="text-xs sm:text-sm"
                    style={{ color: "color-mix(in srgb,var(--text)_85%,transparent)" }}
                  >
                    {value}
                  </span>
                )}
              />

              {selectedIds.map((id, index) => {
                const color = getSeriesColor(index);
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={itemNameMap[id] || id}
                    stroke={color}
                    strokeWidth={2}
                    connectNulls
                    dot={{
                      r: 3.5,
                      strokeWidth: 1,
                      stroke: "var(--bg-1)",
                      fill: color,
                    }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      stroke: "var(--text)",
                    }}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>

          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Tip: selecciona pocos artículos para una lectura más clara; con muchos, la leyenda se vuelve densa.
          </p>
        </div>
      )}
    </div>
  );
}

export default ItemTrendChart;
