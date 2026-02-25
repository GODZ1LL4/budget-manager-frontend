// src/components/reports/RecurringItemPatternsTable.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FFSelect from "../FFSelect";

function formatCurrencyDOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

const FREQUENCY_LABELS = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  irregular: "Irregular",
};

function prettifyKey(s) {
  if (!s) return "—";
  const clean = String(s).trim();
  if (!clean) return "—";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ✅ tonos por frecuencia (usa tokens existentes)
function toneForFrequency(freq) {
  switch (freq) {
    case "semanal":
      return "var(--success)";
    case "quincenal":
      return "var(--primary)";
    case "mensual":
      return "var(--warning)";
    case "bimestral":
      return "var(--danger)";
    case "irregular":
    default:
      return "var(--muted)";
  }
}

function RecurringItemPatternsTable({ token }) {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState("6");
  const [minOccurrences, setMinOccurrences] = useState("3");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    axios
      .get(`${api}/analytics/recurring-item-patterns`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          months: Number(months) || 6,
          min_occurrences: Number(minOccurrences) || 3,
        },
      })
      .then((res) => setData(res.data?.data || []))
      .catch((err) => {
        console.error("Error cargando patrones recurrentes por ítem:", err);
        setError(
          err.response?.data?.error ||
            "No se pudieron cargar los patrones de compra por artículo."
        );
      })
      .finally(() => setLoading(false));
  }, [token, months, minOccurrences, api]);

  const monthsOptions = useMemo(
    () => [
      { value: "3", label: "Últimos 3 meses" },
      { value: "6", label: "Últimos 6 meses" },
      { value: "12", label: "Últimos 12 meses" },
    ],
    []
  );

  const minOccOptions = useMemo(
    () => [
      { value: "2", label: "2+" },
      { value: "3", label: "3+" },
      { value: "4", label: "4+" },
      { value: "5", label: "5+" },
    ],
    []
  );

  // ✅ Buscador (artículo/categoría/variante)
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    return (data || []).filter((row) => {
      const item = String(row?.item_name || "").toLowerCase();
      const cat = String(row?.category_name || "").toLowerCase();
      const variant = String(
        prettifyKey(row?.description_key) || ""
      ).toLowerCase();
      return item.includes(q) || cat.includes(q) || variant.includes(q);
    });
  }, [data, search]);

  // Scroll vertical desde 15 filas (aprox. 15 filas + header)
  const enableYScroll = filteredData.length >= 15;
  const HEADER_H = 44;
  const ROW_H = 44;
  const maxTableHeightPx = HEADER_H + ROW_H * 15;

  // ===== styles tokenizados (sin glow) =====
  const mutedText = "color-mix(in srgb, var(--text) 70%, transparent)";
  const softerText = "color-mix(in srgb, var(--text) 85%, transparent)";
  const thText = "color-mix(in srgb, var(--text) 99%, transparent)";

  const cardStyle = {
    border: `var(--border-w) solid var(--border-rgba)`,
    borderRadius: "var(--radius-lg)",
    background:
      "linear-gradient(135deg, var(--bg-1), color-mix(in srgb, var(--panel) 40%, transparent), var(--bg-1))",
    boxShadow: "0 18px 55px rgba(0,0,0,0.45)", // ✅ sin glow
  };

  const innerHairlineStyle = {
    borderRadius: "inherit",
    border: "1px solid color-mix(in srgb, var(--text) 8%, transparent)",
    pointerEvents: "none",
  };

  const tableShellStyle = {
    border: `var(--border-w) solid var(--border-rgba)`,
    borderRadius: "var(--radius-lg)",
    background: "color-mix(in srgb, var(--panel) 62%, transparent)",
  };

  // ✅ Header más sólido (pero OJO: sticky necesita bg en TH)
  const theadStyle = {
    background: "var(--panel)",
    boxShadow:
      "inset 0 -1px 0 color-mix(in srgb, var(--border-rgba) 92%, transparent)",
  };

  // ✅ ESTO es lo que realmente evita “ver a través”
  const thStickyStyle = {
    background: "var(--panel)",
    color: thText,
  };

  // ✅ highlight para columna “Monto prom.”
  const amountCellStyle = {
    background:
      "linear-gradient(90deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent)",
  };

  const amountTextStyle = {
    color: "color-mix(in srgb, var(--primary) 72%, var(--text))",
  };

  const lastAmountStyle = {
    color: "color-mix(in srgb, var(--text) 65%, transparent)",
  };

  return (
    <div className="relative rounded-2xl p-6 space-y-4" style={cardStyle}>
      <div
        className="absolute inset-[1px] rounded-2xl"
        style={innerHairlineStyle}
      />

      {/* Header */}
      <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h3
            className="text-xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            Patrones de compra por artículo
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Detecta artículos que compras con una frecuencia similar (semanal,
            mensual, etc.), aunque no estén configurados como transacciones
            recurrentes.
          </p>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-[520px]">
          {/* Row 1: selects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="flex flex-col">
              <label
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: mutedText }}
              >
                Período
              </label>

              <FFSelect
                value={months}
                onChange={(v) => setMonths(String(v))}
                options={monthsOptions}
                placeholder="Selecciona período..."
                searchable={false}
                clearable={false}
                className="mt-1 w-full"
                getOptionLabel={(o) => o.label}
                getOptionValue={(o) => o.value}
              />
            </div>

            <div className="flex flex-col">
              <label
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: mutedText }}
              >
                Mín. ocurrencias
              </label>

              <FFSelect
                value={minOccurrences}
                onChange={(v) => setMinOccurrences(String(v))}
                options={minOccOptions}
                placeholder="Selecciona mínimo..."
                searchable={false}
                clearable={false}
                className="mt-1 w-full"
                getOptionLabel={(o) => o.label}
                getOptionValue={(o) => o.value}
              />
            </div>
          </div>

          {/* Row 2: buscador debajo */}
          <div className="mt-3">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: mutedText }}
            >
              Buscar
            </label>

            <div className="relative mt-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Artículo, categoría o variante..."
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
                      "color-mix(in srgb, var(--panel) 70%, transparent)",
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

      {/* Estados */}
      {loading && (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          Buscando patrones de compra por artículo…
        </p>
      )}

      {error && (
        <p
          className="text-sm"
          style={{
            color: "color-mix(in srgb, var(--danger) 75%, var(--text))",
          }}
        >
          {error}
        </p>
      )}

      {!loading && !error && filteredData.length === 0 && (
        <p
          className="text-sm italic"
          style={{ color: "color-mix(in srgb, var(--text) 60%, transparent)" }}
        >
          {search.trim()
            ? `No hay resultados para “${search.trim()}”.`
            : "No se encontraron patrones de compra para el período y filtros seleccionados."}
        </p>
      )}

      {/* Tabla */}
      {!loading && !error && filteredData.length > 0 && (
        <div
          className={`relative overflow-x-auto ${
            enableYScroll ? "overflow-y-auto" : ""
          }`}
          style={
            enableYScroll
              ? { ...tableShellStyle, maxHeight: `${maxTableHeightPx}px` }
              : tableShellStyle
          }
        >
          <table className="min-w-full w-full table-fixed border-separate border-spacing-0 text-[12px]">
            <thead className="relative z-20" style={theadStyle}>
              <tr>
                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[160px] text-left"
                  style={thStickyStyle}
                >
                  Artículo
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[90px] text-left"
                  style={thStickyStyle}
                >
                  Categoría
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[120px] text-left"
                  style={thStickyStyle}
                >
                  Variante
                  <span className="block">/ Concepto</span>
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[80px] text-center"
                  style={thStickyStyle}
                >
                  Frec.
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[70px] text-center"
                  style={thStickyStyle}
                >
                  Ocurr.
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[75px] text-center"
                  style={thStickyStyle}
                >
                  Med.<span className="block">(d)</span>
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[75px] text-center"
                  style={thStickyStyle}
                >
                  Media<span className="block">(d)</span>
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[75px] text-center"
                  style={thStickyStyle}
                >
                  Desv.<span className="block">(d)</span>
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[75px] text-center"
                  style={thStickyStyle}
                >
                  Cant.<span className="block">prom.</span>
                </th>

                {/* ✅ Header resaltado para monto prom (con bg sólido) */}
                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[95px] text-right"
                  style={{
                    ...thStickyStyle,
                    background:
                      "color-mix(in srgb, var(--primary) 10%, var(--panel))",
                  }}
                >
                  Monto<span className="block">prom.</span>
                </th>

                <th
                  className="sticky top-0 z-30 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b border-[var(--border-rgba)] w-[90px] text-center"
                  style={thStickyStyle}
                >
                  Última<span className="block">compra</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredData.map((row, idx) => {
                const zebra =
                  idx % 2 === 0
                    ? "bg-[color-mix(in srgb,var(--panel)_40%,transparent)]"
                    : "bg-[color-mix(in srgb,var(--panel)_55%,transparent)]";

                const tone = toneForFrequency(row.frequency_label);

                return (
                  <tr
                    key={`${row.item_id || "item"}-${
                      row.description_key || "desc"
                    }-${idx}`}
                    className={`${zebra} transition-colors hover:bg-[color-mix(in srgb,var(--primary)_10%,transparent)]`}
                    style={{
                      borderTop:
                        "1px solid color-mix(in srgb, var(--border-rgba) 70%, transparent)",
                    }}
                  >
                    {/* Artículo */}
                    <td className="px-1.5 py-2 align-top">
                      <div
                        className="w-[160px] break-words leading-snug font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {row.item_name || "Sin nombre"}
                      </div>
                    </td>

                    {/* Categoría */}
                    <td className="px-1.5 py-2 align-top">
                      <div
                        className="w-[90px] truncate"
                        title={row.category_name || ""}
                        style={{ color: mutedText }}
                      >
                        {row.category_name || "—"}
                      </div>
                    </td>

                    {/* Variante / Concepto */}
                    <td className="px-1.5 py-2 align-top">
                      <div
                        className="w-[120px] truncate"
                        title={prettifyKey(row.description_key)}
                        style={{ color: softerText }}
                      >
                        {prettifyKey(row.description_key)}
                      </div>
                    </td>

                    {/* Frecuencia badge por tono */}
                    <td className="px-1.5 py-2 align-top text-center">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                        style={{
                          color: "var(--text)",
                          border: `1px solid color-mix(in srgb, ${tone} 40%, var(--border-rgba))`,
                          background: `color-mix(in srgb, ${tone} 14%, transparent)`,
                        }}
                      >
                        {FREQUENCY_LABELS[row.frequency_label] ||
                          row.frequency_label ||
                          "—"}
                      </span>
                    </td>

                    <td
                      className="px-1.5 py-2 align-top text-center tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {row.occurrences}
                    </td>
                    <td
                      className="px-1.5 py-2 align-top text-center tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {row.median_interval_days}
                    </td>
                    <td
                      className="px-1.5 py-2 align-top text-center tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {row.mean_interval_days}
                    </td>
                    <td
                      className="px-1.5 py-2 align-top text-center tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {row.std_dev_interval_days}
                    </td>
                    <td
                      className="px-1.5 py-2 align-top text-center tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {Number(row.avg_quantity || 0).toFixed(2)}
                    </td>

                    {/* Monto prom. resaltado */}
                    <td
                      className="px-1.5 py-2 align-top text-right font-semibold tabular-nums whitespace-nowrap"
                      style={amountCellStyle}
                    >
                      <span style={amountTextStyle}>
                        {formatCurrencyDOP(row.avg_amount)}
                      </span>
                    </td>

                    <td className="px-1.5 py-2 align-top text-center tabular-nums">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className="whitespace-nowrap"
                          style={{ color: mutedText }}
                        >
                          {formatDate(row.last_date)}
                        </span>
                        {row.last_amount != null && (
                          <span
                            className="text-[10px] whitespace-nowrap"
                            style={lastAmountStyle}
                          >
                            {formatCurrencyDOP(row.last_amount)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RecurringItemPatternsTable;
