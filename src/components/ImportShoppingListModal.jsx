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
  if (v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1);
  }
  return v.replace(/""/g, '"');
};

const parseNumber = (raw) => {
  if (raw == null) return NaN;
  const cleaned = String(raw).trim().replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? NaN : n;
};

/**
 * Modal para importar una lista de compra desde CSV
 * Formato esperado: "id";"nombre";"precio";"cantidad"
 *
 * props:
 * - isOpen
 * - onClose
 * - items: array de artículos (idealmente con tax_rate, is_exempt, latest_price si lo usas)
 * - meta: { account_id, category_id, date, description, discount }
 * - api: URL base (VITE_API_URL)
 * - token: auth token
 * - onImported: callback(data) cuando el backend crea la transacción
 */
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
      const text = ev.target.result;
      (async () => {
        try {
          // 1) Parsear CSV (sin precio existente aún)
          const baseRows = parseCsv(text || "", items);

          // 2) Obtener precios existentes para esa fecha
          const itemIds = baseRows.filter((r) => r.item).map((r) => r.item.id);

          let priceMap = new Map();
          if (itemIds.length > 0) {
            try {
              const res = await axios.get(`${api}/item-prices/by-date`, {
                params: {
                  date: meta.date,
                  item_ids: itemIds.join(","),
                },
                headers: {
                  Authorization: `Bearer ${token}`,
                },
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
              // dejamos priceMap vacío → existingPrice = 0
            }
          }

          // 3) Enriquecer filas con existingPrice + chosenPrice + hasExistingPrice
          const enriched = baseRows.map((row) => {
            const hasExistingPrice = row.item
              ? priceMap.has(row.item.id)
              : false;

            const existingPrice =
              row.item && hasExistingPrice
                ? Number(priceMap.get(row.item.id) || 0)
                : 0;

            const chosenPrice = row.newPrice; // por defecto usamos el nuevo
            const subtotal = chosenPrice * row.quantity;
            const taxAmount = row.isExempt ? 0 : subtotal * (row.taxRate / 100);
            const lineTotalWithTax = subtotal + taxAmount;

            return {
              ...row,
              existingPrice,
              hasExistingPrice, // 👈 flag para saber si ese precio viene del backend
              source: "new", // "new" | "existing"
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
    reader.onerror = () => {
      setError("Error al leer el archivo.");
    };

    reader.readAsText(file, "utf-8");
  };

  // Recalcular totales en función de los precios elegidos (por fila)
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
      setError(
        "Debes seleccionar cuenta, categoría y fecha en el formulario de transacción."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const lines = matchedRows.map((r) => ({
        item_id: r.item.id,
        unit_price: r.chosenPrice, // 👈 el precio que el usuario eligió
        quantity: r.quantity,
        price_source: r.source, // "new" o "existing"
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
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = res.data?.data;
      onImported?.(data);

      // limpiar y cerrar
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
      <div className="space-y-4 text-slate-200">
        <p className="text-sm text-slate-300">
          Importa el archivo con columnas{" "}
          <span className="font-mono">id;nombre;precio;cantidad</span>. Para
          cada artículo podrás elegir si se usa el{" "}
          <span className="font-semibold text-emerald-300">precio nuevo</span>{" "}
          del archivo o el{" "}
          <span className="font-semibold text-sky-300">precio existente</span>{" "}
          registrado para la fecha{" "}
          <span className="font-mono">{meta?.date || "—"}</span>. Si no hay
          precio para esa fecha, se considera 0.
        </p>

        {/* Input de archivo */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Archivo CSV
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="
              w-full text-sm
              file:mr-3 file:py-1.5 file:px-3
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-emerald-500/90 file:text-slate-950
              hover:file:bg-emerald-400
              text-slate-100
            "
          />
          {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        </div>

        {/* Resumen */}
        {rows.length > 0 && (
          <div
            className="
              text-xs sm:text-sm text-slate-200
              bg-slate-900/60 border border-slate-700
              rounded-xl px-3 py-2
              flex flex-wrap gap-3
            "
          >
            <span>
              Filas leídas: <span className="font-semibold">{rows.length}</span>
            </span>
            <span>
              Artículos encontrados:{" "}
              <span className="font-semibold text-emerald-400">
                {matchedRows.length}
              </span>
            </span>
            <span>
              Total (antes descuento):{" "}
              <span className="font-semibold text-emerald-300">
                {currency(totalBeforeDiscount)}
              </span>
            </span>
            {discountPct > 0 && (
              <span>
                Total con descuento ({discountPct}%):{" "}
                <span className="font-semibold text-emerald-300">
                  {currency(totalAfterDiscount)}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Tabla preview */}
        <div className="border border-slate-800 rounded-lg p-2 bg-slate-950/40 max-h-64 overflow-auto">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-400 italic">
              Aún no se ha cargado ningún archivo o no se encontraron filas
              válidas.
            </div>
          ) : (
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left bg-slate-900/80 border-b border-slate-800">
                  <th className="py-1 px-2 text-slate-300">ID</th>
                  <th className="py-1 px-2 text-slate-300">Artículo</th>
                  <th className="py-1 px-2 text-right text-slate-300">
                    Cantidad
                  </th>
                  <th className="py-1 px-2 text-right text-slate-300">
                    Precio usado
                  </th>
                  <th className="py-1 px-2 text-right text-slate-300">ITBIS</th>
                  <th className="py-1 px-2 text-right text-slate-300">
                    Total línea
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.rawId || "row"}-${i}`}
                    className={
                      i % 2 === 0
                        ? "border-t border-slate-800 bg-slate-950/40"
                        : "border-t border-slate-800 bg-slate-900/50"
                    }
                  >
                    <td className="py-1 px-2 text-slate-400 font-mono text-[11px]">
                      {r.rawId}
                    </td>
                    <td className="py-1 px-2 text-slate-200">
                      {r.item ? (
                        r.item.name
                      ) : (
                        <span className="italic text-rose-300">
                          No encontrado
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-100">
                      {r.quantity}
                    </td>
                    <td className="py-1 px-2 text-right">
                      {r.item ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePriceSource(i)}
                            className={`
                              inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                              text-[11px] font-semibold border
                              ${
                                r.source === "new"
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                                  : "border-sky-500/70 bg-sky-500/10 text-sky-300"
                              }
                            `}
                          >
                            <span>{currency(r.chosenPrice)}</span>
                            <span className="uppercase tracking-wide">
                              {r.source === "new" ? "nuevo" : "existente"}
                            </span>
                          </button>

                          {/* Flag de precio existente para esa fecha */}
                          {r.hasExistingPrice ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sky-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                              <span>
                                Precio existente:{" "}
                                <span className="font-semibold">
                                  {currency(r.existingPrice)}
                                </span>
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span>Sin precio registrado para esa fecha</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-1 px-2 text-right text-slate-100">
                      {currency(r.taxAmount)}
                    </td>
                    <td className="py-1 px-2 text-right text-emerald-300 font-semibold">
                      {currency(r.lineTotalWithTax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            La transacción se creará como gasto y lista de compra para la fecha
            seleccionada. Los precios existentes sin registro para esa fecha se
            consideran 0.
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || matchedRows.length === 0}
              onClick={handleImport}
              className={`
                px-3 py-2 rounded-lg text-sm font-semibold
                ${
                  loading || matchedRows.length === 0
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.6)] hover:brightness-110 active:scale-95"
                }
                transition-all
              `}
            >
              {loading ? "Importando..." : "Crear transacción"}
            </button>
            <button
              type="button"
              className="
                px-3 py-2 rounded-lg text-sm font-semibold
                border border-slate-600
                bg-slate-900 text-slate-300
                hover:bg-slate-800 hover:border-slate-500
                transition-all
              "
              onClick={() => {
                setRows([]);
                setError("");
                onClose();
              }}
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
 * Parsea CSV "id;nombre;precio;cantidad" y enriquece con info de impuestos (si existe en items).
 * - items debe contener al menos: { id, name, tax_rate?, is_exempt? }
 * - NO calcula existingPrice aquí; eso se hace luego con el backend por fecha.
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
    throw new Error(
      'Se requieren columnas "id", "precio" y "cantidad" en el encabezado.'
    );
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

    // Si tienes tax_rate / is_exempt en items, úsalo; si no, 0.
    const taxRate = item ? Number(item.tax_rate || 0) : 0;
    const isExempt = item ? item.is_exempt === true : false;

    // Aún no calculamos chosenPrice ni totals aquí, eso se hace
    // después de conocer existingPrice.
    result.push({
      rawId,
      name: rawName,
      item,
      quantity,
      newPrice,
      taxRate,
      isExempt,
      existingPrice: null,
      hasExistingPrice: false, // 👈 se llenará luego con la data del backend
      source: "new",
      chosenPrice: newPrice,
      taxAmount: 0,
      lineTotalWithTax: 0,
    });
  }

  return result;
}
