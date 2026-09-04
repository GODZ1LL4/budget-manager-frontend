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
import FFSelect from "../FFSelect";
import { withUserTimeZone } from "../../lib/dates/localDate";

function formatCurrencyDOP(val) {
  const n = Number(val);
  return `RD$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function getSeriesColor(index) {
  return `hsl(${(index * 137.508) % 360}, 70%, 55%)`;
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload || {};
  const total = point.__total == null ? null : Number(point.__total);
  const missingCount = Number(point.__missingTotalCount || 0);
  const totalLabel = point.__totalLabel || "Total seleccionado";

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-xl"
      style={{
        background: "var(--panel)",
        borderColor: "var(--border-rgba)",
        color: "var(--text)",
      }}
    >
      <div className="mb-1 font-bold">{formatDate(label)}</div>
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {payload.map((entry) => {
          const color = entry.color || entry.stroke || "var(--text)";

          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: color }}
              />
              <span className="min-w-0 flex-1 truncate" style={{ color }}>
                {entry.name}
              </span>
              <strong className="tabular-nums" style={{ color }}>
                {formatCurrencyDOP(entry.value)}
              </strong>
            </div>
          );
        })}
      </div>

      {total != null && Number.isFinite(total) ? (
        <div
          className="mt-2 flex items-center justify-between gap-3 border-t pt-2"
          style={{ borderColor: "var(--border-rgba)" }}
        >
          <span style={{ color: "var(--muted)" }}>{totalLabel}</span>
          <strong className="tabular-nums" style={{ color: "var(--text)" }}>
            {formatCurrencyDOP(total)}
          </strong>
        </div>
      ) : null}

      {missingCount > 0 ? (
        <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
          {missingCount} articulo(s) sin precio en esta fecha
        </div>
      ) : null}
    </div>
  );
}

function ItemPriceTrendChart({ token }) {
  const [items, setItems] = useState([]);
  const [shoppingLists, setShoppingLists] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedShoppingListId, setSelectedShoppingListId] = useState("");
  const [priceData, setPriceData] = useState([]);
  const [search, setSearch] = useState("");
  const [shoppingListsLoading, setShoppingListsLoading] = useState(false);

  const api = import.meta.env.VITE_API_URL;

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

  // Obtener listas de compra igual que el command center
  useEffect(() => {
    if (!token) return;

    setShoppingListsLoading(true);

    axios
      .get(
        `${api}/analytics/item-price-command-center`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 1000 },
        })
      )
      .then((res) => {
        setShoppingLists(
          Array.isArray(res.data?.shopping_lists) ? res.data.shopping_lists : []
        );
      })
      .catch((err) => {
        console.error("Error al cargar listas de compra:", err);
        toast.error("No se pudieron cargar las listas de compra.");
      })
      .finally(() => setShoppingListsLoading(false));
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

  const shoppingListOptions = useMemo(
    () =>
      shoppingLists.map((shoppingList) => ({
        ...shoppingList,
        label: `${formatDate(shoppingList.date)} - ${
          shoppingList.description || "Lista de compra"
        }`,
        subLabel: `${shoppingList.item_count || 0} articulo(s) - ${formatCurrencyDOP(
          shoppingList.amount
        )}`,
      })),
    [shoppingLists]
  );

  const selectedShoppingList = useMemo(
    () =>
      shoppingLists.find(
        (shoppingList) =>
          String(shoppingList.id) === String(selectedShoppingListId)
      ) || null,
    [selectedShoppingListId, shoppingLists]
  );

  const selectedShoppingListLinesById = useMemo(() => {
    const map = new Map();
    (selectedShoppingList?.lines || []).forEach((line) => {
      if (line?.item_id) map.set(String(line.item_id), line);
    });
    return map;
  }, [selectedShoppingList]);

  const selectedQuantitiesById = useMemo(() => {
    const map = new Map();

    selectedIds.forEach((id) => {
      const shoppingListLine = selectedShoppingListLinesById.get(String(id));
      const quantity = Number(shoppingListLine?.quantity);
      map.set(String(id), Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
    });

    return map;
  }, [selectedIds, selectedShoppingListLinesById]);

  useEffect(() => {
    if (!selectedShoppingListId) return;
    const exists = shoppingLists.some(
      (shoppingList) => String(shoppingList.id) === String(selectedShoppingListId)
    );
    if (!exists) setSelectedShoppingListId("");
  }, [selectedShoppingListId, shoppingLists]);

  // Crear estructura para gráfico (por fecha)
  const { chartData, itemNameMap } = useMemo(() => {
    const groupedByDate = {};
    const namesById = {};

    priceData.forEach((entry) => {
      const key = entry.date;
      const id = String(entry.item_id);
      const priceWithTax = Number(entry.price_with_tax ?? entry.price);

      if (!key || !id || !Number.isFinite(priceWithTax)) return;
      if (!groupedByDate[key]) groupedByDate[key] = { date: key };

      groupedByDate[key][id] = priceWithTax;
      namesById[id] = entry.item_name;
    });

    const totalLabel = selectedShoppingList
      ? "Total lista"
      : "Total seleccionado";

    const data = Object.values(groupedByDate)
      .map((point) => {
        let total = 0;
        let pricedCount = 0;

        selectedIds.forEach((id) => {
          const price = Number(point[String(id)]);
          if (!Number.isFinite(price)) return;

          total += price * (selectedQuantitiesById.get(String(id)) || 1);
          pricedCount += 1;
        });

        return {
          ...point,
          __total: pricedCount > 0 ? total : null,
          __totalLabel: totalLabel,
          __missingTotalCount: Math.max(0, selectedIds.length - pricedCount),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return { chartData: data, itemNameMap: namesById };
  }, [priceData, selectedIds, selectedQuantitiesById, selectedShoppingList]);

  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    setSelectedShoppingListId("");

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;
      setSelectedIds([...selectedIds, idStr]);
    } else {
      setSelectedIds(selectedIds.filter((x) => x !== idStr));
    }
  };

  const selectShoppingList = (value, option) => {
    const shoppingList =
      option ||
      shoppingLists.find((list) => String(list.id) === String(value || ""));

    setSelectedShoppingListId(value ? String(value) : "");

    if (!shoppingList) return;

    const itemIds = Array.from(
      new Set((shoppingList.item_ids || []).map((itemId) => String(itemId)))
    );

    if (itemIds.length === 0) {
      toast.info("Esa lista no tiene articulos para graficar.");
      return;
    }

    setSelectedIds(itemIds);
    setSearch("");
  };

  const handleClearAll = () => {
    setSelectedIds([]);
    setSelectedShoppingListId("");
  };

  // ===== Recharts token styles =====
  const gridStroke = "color-mix(in srgb, var(--border-rgba) 55%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 55%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";

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
            Artículos seleccionados:{" "}
            <span className="font-semibold text-[var(--text)]">
              {selectedIds.length}
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
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

          <div className="min-w-0">
            <label className="text-xs mb-1 block text-[color-mix(in srgb,var(--text)_70%,transparent)]">
              Lista de compra
            </label>

            <FFSelect
              value={selectedShoppingListId}
              onChange={selectShoppingList}
              options={shoppingListOptions}
              placeholder={
                shoppingListsLoading
                  ? "Cargando listas..."
                  : shoppingListOptions.length
                  ? "Elige una lista..."
                  : "Sin listas en el rango"
              }
              disabled={shoppingListsLoading || shoppingListOptions.length === 0}
              clearable
              maxVisible={60}
              className="w-full"
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.id}
              renderOption={(option) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{option.label}</span>
                  <span
                    className="mt-0.5 truncate text-[11px]"
                    style={{ color: "var(--select-muted)" }}
                  >
                    {option.subLabel}
                  </span>
                </div>
              )}
            />

            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              {selectedShoppingList
                ? `${selectedShoppingList.item_count || 0} articulo(s), ${
                    selectedShoppingList.line_count || 0
                  } linea(s)`
                : shoppingListsLoading
                ? "Cargando listas..."
                : `${shoppingListOptions.length} lista(s) en el rango`}
            </p>
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
          Selecciona uno o más artículos para ver su tendencia de precios.
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
                content={<TrendTooltip />}
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
                const color = getSeriesColor(index);
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
