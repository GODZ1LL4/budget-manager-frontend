import { useState } from "react";
import axios from "axios";
import Modal from "./Modal";

function currency(n) {
  const v = Number(n || 0);
  return `RD$ ${v.toFixed(2)}`;
}

const stripQuotes = (s) => {
  if (s == null) return "";
  let v = String(s).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v.replace(/""/g, '"');
};

const parseNumber = (raw) => {
  if (raw == null) return NaN;
  const cleaned = String(raw).trim().replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? NaN : n;
};

export default function ImportShoppingListModal({
  isOpen,
  onClose,
  items,
  meta,
  api,
  token,
  onImported,
}) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ tokens helpers
  const border = "var(--border-rgba)";
  const panel = "var(--panel)";
  const text = "var(--text)";
  const muted = "var(--muted)";
  const primary = "var(--primary)";
  const success = "var(--success)";
  const warning = "var(--warning)";
  const danger = "var(--danger)";

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!meta?.date) {
      setError(
        "Debes seleccionar primero la fecha de la transacción para poder comparar precios existentes."
      );
      return;
    }

    setError("");
    setRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const textFile = ev.target.result;

      (async () => {
        try {
          // 1) Parse CSV
          const baseRows = parseCsv(textFile || "", items);

          // 2) Fetch existing prices by date
          const itemIds = baseRows.filter((r) => r.item).map((r) => r.item.id);

          let priceMap = new Map();
          if (itemIds.length > 0) {
            try {
              const res = await axios.get(`${api}/item-prices/by-date`, {
                params: { date: meta.date, item_ids: itemIds.join(",") },
                headers: { Authorization: `Bearer ${token}` },
              });

              const data = res.data?.data || [];
              priceMap = new Map(
                data.map((p) => [p.item_id, Number(p.price || 0)])
              );
            } catch (err) {
              console.error(
                "⚠️ No se pudieron obtener precios existentes, se usará 0 por defecto:",
                err
              );
            }
          }

          // 3) Enrich
          const enriched = baseRows.map((row) => {
            const hasExistingPrice = row.item
              ? priceMap.has(row.item.id)
              : false;

            const existingPrice =
              row.item && hasExistingPrice
                ? Number(priceMap.get(row.item.id) || 0)
                : 0;

            const chosenPrice = row.newPrice; // default new
            const subtotal = chosenPrice * row.quantity;
            const taxAmount = row.isExempt ? 0 : subtotal * (row.taxRate / 100);
            const lineTotalWithTax = subtotal + taxAmount;

            return {
              ...row,
              existingPrice,
              hasExistingPrice,
              source: "new",
              chosenPrice,
              taxAmount,
              lineTotalWithTax,
            };
          });

          setRows(enriched);
        } catch (err) {
          console.error("❌ Error parseando CSV:", err);
          setError(
            err?.message ||
              "No se pudo leer el archivo. Verifica el formato del CSV."
          );
        }
      })();
    };

    reader.onerror = () => setError("Error al leer el archivo.");
    reader.readAsText(file, "utf-8");
  };

  const matchedRows = rows.filter((r) => r.item);

  const totalBeforeDiscount = matchedRows.reduce(
    (sum, r) => sum + (r.lineTotalWithTax || 0),
    0
  );

  const discountPct = Number(meta?.discount || 0);
  const discountFactor = discountPct > 0 ? 1 - discountPct / 100 : 1;
  const totalAfterDiscount = totalBeforeDiscount * discountFactor;

  const handleTogglePriceSource = (index) => {
    setRows((prev) => {
      const copy = [...prev];
      const row = copy[index];
      if (!row || row.existingPrice == null) return prev;

      const nextSource = row.source === "new" ? "existing" : "new";
      const chosenPrice =
        nextSource === "new" ? row.newPrice : row.existingPrice;

      const subtotal = chosenPrice * row.quantity;
      const taxAmount = row.isExempt ? 0 : subtotal * (row.taxRate / 100);
      const lineTotalWithTax = subtotal + taxAmount;

      copy[index] = {
        ...row,
        source: nextSource,
        chosenPrice,
        taxAmount,
        lineTotalWithTax,
      };
      return copy;
    });
  };

  const handleImport = async () => {
    if (!matchedRows.length) {
      setError("No hay filas válidas con artículos encontrados.");
      return;
    }
    if (!meta?.account_id || !meta?.category_id || !meta?.date) {
      setError("Debes seleccionar cuenta, categoría y fecha en el formulario.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const lines = matchedRows.map((r) => ({
        item_id: r.item.id,
        unit_price: r.chosenPrice,
        quantity: r.quantity,
        price_source: r.source,
        new_price: r.newPrice,
        existing_price: r.existingPrice,
      }));

      const res = await axios.post(
        `${api}/transactions/import-shopping-list`,
        {
          account_id: meta.account_id,
          category_id: meta.category_id,
          date: meta.date,
          description: meta.description,
          discount: discountPct,
          lines,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data?.data;
      onImported?.(data);

      setRows([]);
      setError("");
      onClose();
    } catch (e) {
      console.error("❌ Error importando lista de compra:", e);
      setError(
        e.response?.data?.error ||
          e.message ||
          "Error al importar la lista de compra"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setRows([]);
        setError("");
        onClose();
      }}
      title="Importar lista de compra"
      size="xl"
    >
      <div className="space-y-4" style={{ color: text }}>
        <p className="text-sm" style={{ color: muted }}>
          Importa el archivo con columnas{" "}
          <span className="font-mono" style={{ color: text }}>
            id;nombre;precio;cantidad
          </span>
          . Para cada artículo podrás elegir si se usa el{" "}
          <span style={{ color: success, fontWeight: 700 }}>precio nuevo</span>{" "}
          del archivo o el{" "}
          <span style={{ color: primary, fontWeight: 700 }}>
            precio existente
          </span>{" "}
          registrado para la fecha{" "}
          <span className="font-mono" style={{ color: text }}>
            {meta?.date || "—"}
          </span>
          . Si no hay precio para esa fecha, se considera 0.
        </p>

        {/* Input archivo */}
        {/* Input de archivo (estilo botón) */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--text)" }}
          >
            Archivo CSV
          </label>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="
      block w-full text-sm
      file:mr-3 file:rounded-lg file:border file:border-transparent
      file:px-4 file:py-2
      file:text-sm file:font-semibold
      file:bg-[var(--primary)] file:text-[var(--primary-contrast,var(--bg-1))]
      hover:file:brightness-110
      active:file:scale-95
      file:transition-all
      text-[var(--muted)]
    "
            style={{
              // por si tu browser pinta fondo raro
              background: "transparent",
            }}
          />

          {error && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Resumen */}
        {rows.length > 0 && (
          <div
            className="text-xs sm:text-sm rounded-xl px-3 py-2 flex flex-wrap gap-3"
            style={{
              background: `color-mix(in srgb, ${panel} 78%, transparent)`,
              border: `var(--border-w) solid ${border}`,
              color: text,
            }}
          >
            <span>
              Filas leídas:{" "}
              <span style={{ fontWeight: 800 }}>{rows.length}</span>
            </span>
            <span>
              Artículos encontrados:{" "}
              <span style={{ fontWeight: 800, color: success }}>
                {matchedRows.length}
              </span>
            </span>
            <span>
              Total (antes descuento):{" "}
              <span style={{ fontWeight: 800, color: success }}>
                {currency(totalBeforeDiscount)}
              </span>
            </span>
            {discountPct > 0 && (
              <span>
                Total con descuento ({discountPct}%):{" "}
                <span style={{ fontWeight: 800, color: success }}>
                  {currency(totalAfterDiscount)}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Tabla */}
        <div
          className="rounded-lg p-2 max-h-64 overflow-auto"
          style={{
            border: `var(--border-w) solid ${border}`,
            background: `color-mix(in srgb, ${panel} 70%, transparent)`,
          }}
        >
          {rows.length === 0 ? (
            <div className="text-sm italic" style={{ color: muted }}>
              Aún no se ha cargado ningún archivo o no se encontraron filas
              válidas.
            </div>
          ) : (
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr
                  className="text-left border-b"
                  style={{
                    background: `color-mix(in srgb, ${panel} 86%, transparent)`,
                    borderColor: border,
                  }}
                >
                  <th className="py-1 px-2" style={{ color: muted }}>
                    ID
                  </th>
                  <th className="py-1 px-2" style={{ color: muted }}>
                    Artículo
                  </th>
                  <th className="py-1 px-2 text-right" style={{ color: muted }}>
                    Cantidad
                  </th>
                  <th className="py-1 px-2 text-right" style={{ color: muted }}>
                    Precio usado
                  </th>
                  <th className="py-1 px-2 text-right" style={{ color: muted }}>
                    ITBIS
                  </th>
                  <th className="py-1 px-2 text-right" style={{ color: muted }}>
                    Total línea
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const rowBg =
                    i % 2 === 0
                      ? `color-mix(in srgb, ${panel} 74%, transparent)`
                      : `color-mix(in srgb, ${panel} 82%, transparent)`;

                  return (
                    <tr
                      key={`${r.rawId || "row"}-${i}`}
                      style={{
                        background: rowBg,
                        borderTop: `1px solid color-mix(in srgb, ${border} 70%, transparent)`,
                      }}
                    >
                      <td
                        className="py-1 px-2 font-mono text-[11px]"
                        style={{ color: muted }}
                      >
                        {r.rawId}
                      </td>

                      <td className="py-1 px-2" style={{ color: text }}>
                        {r.item ? (
                          r.item.name
                        ) : (
                          <span style={{ color: danger, fontStyle: "italic" }}>
                            No encontrado
                          </span>
                        )}
                      </td>

                      <td
                        className="py-1 px-2 text-right"
                        style={{ color: text }}
                      >
                        {r.quantity}
                      </td>

                      <td className="py-1 px-2 text-right">
                        {r.item ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePriceSource(i)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                              style={
                                r.source === "new"
                                  ? {
                                      borderColor: `color-mix(in srgb, ${success} 45%, ${border})`,
                                      background: `color-mix(in srgb, ${success} 12%, transparent)`,
                                      color: success,
                                    }
                                  : {
                                      borderColor: `color-mix(in srgb, ${primary} 45%, ${border})`,
                                      background: `color-mix(in srgb, ${primary} 12%, transparent)`,
                                      color: primary,
                                    }
                              }
                            >
                              <span>{currency(r.chosenPrice)}</span>
                              <span className="uppercase tracking-wide">
                                {r.source === "new" ? "nuevo" : "existente"}
                              </span>
                            </button>

                            {r.hasExistingPrice ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px]"
                                style={{ color: primary }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: primary }}
                                />
                                <span>
                                  Precio existente:{" "}
                                  <span
                                    style={{ fontWeight: 700, color: text }}
                                  >
                                    {currency(r.existingPrice)}
                                  </span>
                                </span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px]"
                                style={{ color: warning }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: warning }}
                                />
                                <span>
                                  Sin precio registrado para esa fecha
                                </span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: muted }}>—</span>
                        )}
                      </td>

                      <td
                        className="py-1 px-2 text-right"
                        style={{ color: text }}
                      >
                        {currency(r.taxAmount)}
                      </td>

                      <td
                        className="py-1 px-2 text-right"
                        style={{ color: success, fontWeight: 800 }}
                      >
                        {currency(r.lineTotalWithTax)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs" style={{ color: muted }}>
            La transacción se creará como gasto y lista de compra para la fecha
            seleccionada. Los precios existentes sin registro para esa fecha se
            consideran 0.
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || matchedRows.length === 0}
              onClick={handleImport}
              className="ff-btn ff-btn-primary"
              style={
                loading || matchedRows.length === 0
                  ? { opacity: 0.55, cursor: "not-allowed", boxShadow: "none" }
                  : undefined
              }
            >
              {loading ? "Importando..." : "Crear transacción"}
            </button>

            <button
              type="button"
              onClick={() => {
                setRows([]);
                setError("");
                onClose();
              }}
              className="ff-btn ff-btn-outline"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * CSV: "id;nombre;precio;cantidad"
 * items: { id, name, tax_rate?, is_exempt? }
 */
function parseCsv(text, items) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  const header = lines[0].split(";");
  const idxId = header.findIndex((h) =>
    stripQuotes(h).toLowerCase().includes("id")
  );
  const idxPrice = header.findIndex((h) =>
    stripQuotes(h).toLowerCase().includes("precio")
  );
  const idxQty = header.findIndex((h) =>
    stripQuotes(h).toLowerCase().includes("cantidad")
  );
  const idxName = header.findIndex((h) =>
    stripQuotes(h).toLowerCase().includes("nombre")
  );

  if (idxId === -1 || idxPrice === -1 || idxQty === -1) {
    throw new Error('Se requieren columnas "id", "precio" y "cantidad".');
  }

  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (!cols[idxId]) continue;

    const rawId = stripQuotes(cols[idxId]);
    const rawName = idxName >= 0 ? stripQuotes(cols[idxName]) : "";

    const priceRaw = cols[idxPrice] ? stripQuotes(cols[idxPrice]) : "";
    const qtyRaw = cols[idxQty] ? stripQuotes(cols[idxQty]) : "1";

    const priceNum = parseNumber(priceRaw);
    const qtyNum = parseNumber(qtyRaw);

    const newPrice = Number.isNaN(priceNum) ? 0 : priceNum;
    const quantity = Number.isNaN(qtyNum) ? 1 : qtyNum;

    const item = items.find((it) => it.id === rawId) || null;

    const taxRate = item ? Number(item.tax_rate || 0) : 0;
    const isExempt = item ? item.is_exempt === true : false;

    result.push({
      rawId,
      name: rawName,
      item,
      quantity,
      newPrice,
      taxRate,
      isExempt,
      existingPrice: null,
      hasExistingPrice: false,
      source: "new",
      chosenPrice: newPrice,
      taxAmount: 0,
      lineTotalWithTax: 0,
    });
  }

  return result;
}
