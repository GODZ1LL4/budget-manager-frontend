import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import Modal from "./Modal";

function currency(n) {
  const v = Number(n || 0);
  return `RD$ ${v.toFixed(2)}`;
}

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

/**
 * Dropdown renderizado en document.body (portal) para evitar que se recorte
 * por overflow del modal / contenedores.
 */
function TypeaheadDropdown({ anchorEl, open, onClose, children }) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();

      const top = rect.bottom + 6;
      const maxH = Math.max(140, window.innerHeight - top - 12);

      setStyle({
        position: "fixed",
        top,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(260, maxH),
        zIndex: 9999,
      });
    };

    update();
    window.addEventListener("resize", update);
    // true => captura scroll dentro de contenedores (incluye el modal)
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorEl]);

  if (!open || !style) return null;

  return createPortal(
    <>
      {/* Click afuera para cerrar */}
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[9998] cursor-default"
        aria-label="close"
        tabIndex={-1}
      />
      <div style={style} className="z-[9999]">
        {children}
      </div>
    </>,
    document.body
  );
}

export default function ShoppingListQuickModal({
  isOpen,
  onClose,
  api,
  token,
  items, // items-with-price (id, name, latest_price, tax_rate, is_exempt)
  meta, // { account_id, category_id, date, description, discount }
  onCreated, // callback(data)
}) {
  const [rows, setRows] = useState([
    { item_id: "", quantity: 1, gross_total: "" },
  ]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);

  // Typeahead states
  const [itemQueries, setItemQueries] = useState([""]);
  const [openDropdownIdx, setOpenDropdownIdx] = useState(null);
  const itemInputRefs = useRef([]); // refs por fila

  // Reset modal when open/close changes
  useEffect(() => {
    if (!isOpen) return;
    setRows([{ item_id: "", quantity: 1, gross_total: "" }]);
    setPreview(null);
    setError("");
    setLoadingPreview(false);
    setLoadingCreate(false);

    setItemQueries([""]);
    setOpenDropdownIdx(null);
    itemInputRefs.current = [];
  }, [isOpen]);

  // Mantener itemQueries sincronizado con rows (add/remove)
  useEffect(() => {
    setItemQueries((prev) => {
      const next = [...prev];
      while (next.length < rows.length) next.push("");
      while (next.length > rows.length) next.pop();
      return next;
    });
  }, [rows.length]);

  // Si una fila ya tiene item_id y el input está vacío, rellenar con el nombre
  useEffect(() => {
    setItemQueries((prev) => {
      let changed = false;
      const next = [...prev];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.item_id) continue;

        const it = items?.find((x) => x.id === row.item_id);
        if (!it) continue;

        if (!next[i] || normalize(next[i]) === "") {
          next[i] = it.name;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [rows, items]);

  const canPreview = useMemo(() => {
    if (!meta?.date) return false;
    const valid = rows.some(
      (r) =>
        r.item_id && toNum(r.quantity, 0) > 0 && toNum(r.gross_total, 0) > 0
    );
    return valid;
  }, [rows, meta?.date]);

  const addRow = () =>
    setRows((prev) => [...prev, { item_id: "", quantity: 1, gross_total: "" }]);

  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setItemQueries((prev) => prev.filter((_, i) => i !== idx));
    itemInputRefs.current = itemInputRefs.current.filter((_, i) => i !== idx);

    setOpenDropdownIdx((cur) => {
      if (cur == null) return cur;
      if (cur === idx) return null;
      // si quitas una fila antes, desplaza el índice
      return cur > idx ? cur - 1 : cur;
    });
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const buildPreviewLines = () =>
    rows
      .filter(
        (r) =>
          r.item_id && toNum(r.quantity, 0) > 0 && toNum(r.gross_total, 0) > 0
      )
      .map((r) => ({
        item_id: r.item_id,
        quantity: toNum(r.quantity, 1),
        price_input_mode: "gross",
        gross_total: toNum(r.gross_total, 0),
      }));

  const filteredItemsForRow = (idx) => {
    const q = normalize(itemQueries[idx]);
    if (!q) return items;
    return items.filter((it) => normalize(it.name).includes(q));
  };

  const selectItemForRow = (idx, it) => {
    updateRow(idx, "item_id", it.id);
    setItemQueries((prev) => {
      const copy = [...prev];
      copy[idx] = it.name;
      return copy;
    });
    setOpenDropdownIdx(null);
  };

  const handlePreview = async () => {
    if (!meta?.date) {
      setError("Debes seleccionar una fecha antes de previsualizar.");
      return;
    }
    setError("");
    setPreview(null);
    setLoadingPreview(true);

    try {
      const res = await axios.post(
        `${api}/transactions/shopping-list/preview`,
        {
          date: meta.date,
          discount: Number(meta?.discount || 0),
          lines: buildPreviewLines(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data?.data;
      const lines = data?.lines || [];

      // resolución por defecto:
      // - conflict => use_existing
      // - same_as_existing => use_existing
      // - insert_new => insert_new
      const normalized = lines.map((l) => {
        let resolution = l.default_resolution || "insert_new";
        if (l.price_status === "conflict") resolution = "use_existing";
        if (l.price_status === "same_as_existing") resolution = "use_existing";
        if (l.price_status === "insert_new") resolution = "insert_new";
        return { ...l, resolution };
      });

      setPreview({
        ...data,
        lines: normalized,
      });
    } catch (e) {
      console.error("❌ Preview error:", e);
      setError(
        e.response?.data?.error || e.message || "Error generando preview"
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  // Toggle resolución en preview (solo conflict)
  const toggleResolution = (item_id) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const lines = prev.lines.map((l) => {
        if (l.item_id !== item_id) return l;
        if (l.price_status !== "conflict") return l;

        const next =
          l.resolution === "use_existing" ? "update_existing" : "use_existing";
        return { ...l, resolution: next };
      });
      return { ...prev, lines };
    });
  };

  const hasUnresolvedConflicts = useMemo(() => {
    if (!preview?.lines?.length) return false;
    return preview.lines.some(
      (l) =>
        l.price_status === "conflict" &&
        !["use_existing", "update_existing"].includes(l.resolution)
    );
  }, [preview]);

  const handleCreate = async () => {
    if (!meta?.account_id || !meta?.category_id || !meta?.date) {
      setError("Debes seleccionar cuenta, categoría y fecha antes de guardar.");
      return;
    }
    if (!preview?.lines?.length) {
      setError("Primero debes generar el preview.");
      return;
    }
    if (hasUnresolvedConflicts) {
      setError("Hay conflictos de precio sin resolver.");
      return;
    }

    setLoadingCreate(true);
    setError("");

    try {
      const submitLines = preview.lines.map((l) => ({
        item_id: l.item_id,
        quantity: l.quantity,
        price_input_mode: "gross",
        gross_total: l.input?.gross_total ?? l.computed?.line_total_gross ?? 0,
        resolution: l.resolution,
      }));

      const res = await axios.post(
        `${api}/transactions/shopping-list`,
        {
          account_id: meta.account_id,
          category_id: meta.category_id,
          date: meta.date,
          description: meta.description,
          discount: Number(meta?.discount || 0),
          lines: submitLines,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      onCreated?.(res.data?.data);
      onClose();
    } catch (e) {
      console.error("❌ Create error:", e);
      setError(
        e.response?.data?.message ||
          e.response?.data?.error ||
          e.message ||
          "Error creando la lista de compra"
      );
    } finally {
      setLoadingCreate(false);
    }
  };

  const previewTotals = useMemo(() => {
    if (!preview?.lines?.length) return null;

    let totalBefore = 0;

    for (const l of preview.lines) {
      const qty = toNum(l.quantity, 1);
      const isExempt = l.is_exempt === true;
      const taxRate = toNum(l.tax_rate, 0);

      const netUnit =
        l.resolution === "use_existing" && l.existing_price_on_date != null
          ? toNum(l.existing_price_on_date, 0)
          : toNum(l.computed?.unit_price_net, 0);

      const subtotal = netUnit * qty;
      const taxAmount = isExempt ? 0 : subtotal * (taxRate / 100);
      totalBefore += subtotal + taxAmount;
    }

    const discountPct = toNum(preview.discount, 0);
    const factor = discountPct > 0 ? 1 - discountPct / 100 : 1;

    return {
      totalBeforeDiscount: totalBefore,
      totalAfterDiscount: totalBefore * factor,
    };
  }, [preview]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lista de compra rápida"
      size="xl"
    >
      <div className="space-y-4 text-slate-200">
        {!meta?.date && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            ⚠️ Selecciona una <strong>fecha</strong> en el formulario antes de
            abrir el preview.
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        {/* Editor de filas */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 p-3 space-y-2">
          <div className="text-xs text-slate-400">
            Escribe el <strong>total pagado (con ITBIS)</strong> por línea. La
            app calcula el neto.
          </div>

          {rows.map((r, idx) => {
            const item = items.find((it) => it.id === r.item_id);
            const anchorEl = itemInputRefs.current[idx] || null;

            return (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border-t border-slate-800 pt-2"
              >
                {/* Typeahead input (buscable) */}
                <div className="sm:col-span-5 w-full">
                  <input
                    ref={(el) => (itemInputRefs.current[idx] = el)}
                    value={itemQueries[idx] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;

                      setItemQueries((prev) => {
                        const copy = [...prev];
                        copy[idx] = v;
                        return copy;
                      });

                      setOpenDropdownIdx(idx);

                      // si borra, limpiamos selección real
                      if (!v) updateRow(idx, "item_id", "");
                    }}
                    onFocus={() => setOpenDropdownIdx(idx)}
                    placeholder="Escribe para buscar artículo..."
                    className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-100"
                  />

                  {/* Dropdown en portal (NO se corta por el modal) */}
                  <TypeaheadDropdown
                    anchorEl={anchorEl}
                    open={openDropdownIdx === idx}
                    onClose={() => setOpenDropdownIdx(null)}
                  >
                    <div
                      className="
                      w-full
                      max-h-[240px]
                      overflow-y-auto
                      overscroll-contain
                      rounded-lg
                      border
                      border-slate-700
                      bg-slate-950
                      shadow-xl
                    "
                    >
                      <button
                        type="button"
                        onClick={() => {
                          updateRow(idx, "item_id", "");
                          setItemQueries((prev) => {
                            const copy = [...prev];
                            copy[idx] = "";
                            return copy;
                          });
                          setOpenDropdownIdx(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/60 border-b border-slate-800"
                      >
                        — Limpiar selección —
                      </button>

                      {filteredItemsForRow(idx)
                        .slice(0, 50)
                        .map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => selectItemForRow(idx, it)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/60"
                          >
                            {it.name}
                            <span className="ml-2 text-xs text-slate-400">
                              ({currency(it.latest_price)})
                            </span>
                          </button>
                        ))}

                      {filteredItemsForRow(idx).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">
                          No hay resultados.
                        </div>
                      )}
                    </div>
                  </TypeaheadDropdown>
                </div>

                <input
                  type="number"
                  step="0.0001"
                  value={r.quantity}
                  onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                  placeholder="Cantidad"
                  className="sm:col-span-2 w-full rounded-lg px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-100"
                />

                <input
                  type="number"
                  step="0.01"
                  value={r.gross_total}
                  onChange={(e) =>
                    updateRow(idx, "gross_total", e.target.value)
                  }
                  placeholder="Total pagado"
                  className="sm:col-span-3 w-full rounded-lg px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-100"
                />

                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="sm:col-span-2 px-3 py-2 rounded-lg text-sm font-semibold bg-rose-600/90 hover:brightness-110 active:scale-95 transition-all"
                >
                  Quitar
                </button>

                {item && (
                  <div className="sm:col-span-12 text-[11px] text-slate-400">
                    latest_price:{" "}
                    <span className="text-emerald-300 font-semibold">
                      {currency(item.latest_price)}
                    </span>{" "}
                    • ITBIS:{" "}
                    <span className="text-slate-200 font-semibold">
                      {item.is_exempt
                        ? "Exento"
                        : `${Number(item.tax_rate || 0)}%`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:brightness-110 active:scale-95 transition-all"
            >
              Agregar línea
            </button>

            <button
              type="button"
              disabled={!canPreview || loadingPreview}
              onClick={handlePreview}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                !canPreview || loadingPreview
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:brightness-110 active:scale-95"
              }`}
            >
              {loadingPreview ? "Generando preview..." : "Preview"}
            </button>
          </div>
        </div>

        {/* Preview tabla */}
        {preview?.lines?.length > 0 && (
          <div className="border border-slate-800 rounded-xl bg-slate-950/40 p-3 space-y-3">
            <div className="flex flex-wrap gap-3 text-xs text-slate-200">
              <span>
                Fecha: <span className="font-semibold">{preview.date}</span>
              </span>
              <span>
                Descuento:{" "}
                <span className="font-semibold">{preview.discount || 0}%</span>
              </span>
              {previewTotals && (
                <>
                  <span>
                    Total (antes):{" "}
                    <span className="font-semibold text-emerald-300">
                      {currency(previewTotals.totalBeforeDiscount)}
                    </span>
                  </span>
                  <span>
                    Total (con desc):{" "}
                    <span className="font-semibold text-emerald-300">
                      {currency(previewTotals.totalAfterDiscount)}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="max-h-64 overflow-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left bg-slate-900/80 border-b border-slate-800">
                    <th className="py-1 px-2 text-slate-300">Artículo</th>
                    <th className="py-1 px-2 text-right text-slate-300">
                      Cant
                    </th>
                    <th className="py-1 px-2 text-right text-slate-300">
                      Neto calc
                    </th>
                    <th className="py-1 px-2 text-right text-slate-300">
                      Existente día
                    </th>
                    <th className="py-1 px-2 text-right text-slate-300">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((l, i) => {
                    const it = items.find((x) => x.id === l.item_id);
                    const isConflict = l.price_status === "conflict";
                    const hasExisting = l.existing_price_on_date != null;

                    return (
                      <tr
                        key={`${l.item_id}-${i}`}
                        className={
                          i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/50"
                        }
                      >
                        <td className="py-1 px-2 text-slate-100">
                          {it?.name || l.item_id}
                          <div className="text-[10px] text-slate-400">
                            latest: {currency(l.latest_price)} • ITBIS:{" "}
                            {l.is_exempt
                              ? "Exento"
                              : `${Number(l.tax_rate || 0)}%`}
                          </div>
                        </td>
                        <td className="py-1 px-2 text-right text-slate-100">
                          {l.quantity}
                        </td>
                        <td className="py-1 px-2 text-right text-emerald-300 font-semibold">
                          {currency(l.computed?.unit_price_net)}
                        </td>
                        <td className="py-1 px-2 text-right text-sky-300 font-semibold">
                          {hasExisting
                            ? currency(l.existing_price_on_date)
                            : "—"}
                        </td>
                        <td className="py-1 px-2 text-right">
                          {isConflict ? (
                            <button
                              type="button"
                              onClick={() => toggleResolution(l.item_id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                l.resolution === "update_existing"
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                                  : "border-sky-500/70 bg-sky-500/10 text-sky-300"
                              }`}
                            >
                              {l.resolution === "update_existing"
                                ? "Actualizar"
                                : "Usar existente"}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {l.price_status === "same_as_existing"
                                ? "OK"
                                : l.price_status === "insert_new"
                                ? "Insertará precio del día"
                                : l.price_status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasUnresolvedConflicts && (
              <div className="text-xs text-amber-300">
                ⚠️ Hay conflictos sin resolver.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={loadingCreate}
                onClick={handleCreate}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loadingCreate
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.6)] hover:brightness-110 active:scale-95"
                }`}
              >
                {loadingCreate ? "Creando..." : "Crear transacción"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:border-slate-500 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
