//frontend\src\components\ShoppingListQuickModal.jsx
import { useEffect, useMemo, useState } from "react";
import FFSelect from "./FFSelect";
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

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function computeGrossFromLatest(item, qty) {
  if (!item) return "";
  const q = toNum(qty, 0);
  if (q <= 0) return "";
  const netUnit = toNum(item.latest_price, 0);
  const taxRate = item.is_exempt ? 0 : toNum(item.tax_rate, 0);
  const subtotal = netUnit * q;
  const tax = subtotal * (taxRate / 100);
  const gross = subtotal + tax;
  return String(round2(gross));
}

/**
 * Dropdown renderizado en document.body (portal) para evitar que se recorte
 * por overflow del modal / contenedores.
 */

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
    { item_id: "", quantity: 1, gross_total: "", gross_touched: false },
  ]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);

  // Reset modal when open/close changes
  useEffect(() => {
    if (!isOpen) return;
    setRows([
      { item_id: "", quantity: 1, gross_total: "", gross_touched: false },
    ]);
    setPreview(null);
    setError("");
    setLoadingPreview(false);
    setLoadingCreate(false);
  }, [isOpen]);

  const canPreview = useMemo(() => {
    if (!meta?.date) return false;
    return rows.some(
      (r) =>
        r.item_id && toNum(r.quantity, 0) > 0 && toNum(r.gross_total, 0) > 0
    );
  }, [rows, meta?.date]);

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { item_id: "", quantity: 1, gross_total: "", gross_touched: false },
    ]);

  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
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

      const handleQtyChange = (idx, newQty) => {
        const safeQty = Math.max(0, toNum(newQty, 0)); 
      
        setRows((prev) => {
          const copy = [...prev];
          const row = copy[idx];
          if (!row) return prev;
      
          const nextRow = { ...row, quantity: safeQty };
      
          if (!row.gross_touched && row.item_id) {
            const it = items?.find((x) => x.id === row.item_id);
            if (it) nextRow.gross_total = computeGrossFromLatest(it, safeQty);
          }
      
          copy[idx] = nextRow;
          return copy;
        });
      };
      

      const handleGrossChange = (idx, v) => {
        const safe = Math.max(0, toNum(v, 0)); 
      
        setRows((prev) => {
          const copy = [...prev];
          const row = copy[idx];
          if (!row) return prev;
      
          const nextRow = {
            ...row,
            gross_total: safe,
            gross_touched: safe > 0,
          };
      
          if (safe === 0 && row.item_id) {
            const it = items?.find((x) => x.id === row.item_id);
            if (it) nextRow.gross_total = computeGrossFromLatest(it, row.quantity);
          }
      
          copy[idx] = nextRow;
          return copy;
        });
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

      const normalized = lines.map((l) => {
        let resolution = l.default_resolution || "insert_new";
        if (l.price_status === "conflict") resolution = "use_existing";
        if (l.price_status === "same_as_existing") resolution = "use_existing";
        if (l.price_status === "insert_new") resolution = "insert_new";
        return { ...l, resolution };
      });

      setPreview({ ...data, lines: normalized });
    } catch (e) {
      console.error("❌ Preview error:", e);
      setError(
        e.response?.data?.error || e.message || "Error generando preview"
      );
    } finally {
      setLoadingPreview(false);
    }
  };

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
      <div className="space-y-4" style={{ color: "var(--text)" }}>
        {!meta?.date && (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor:
                "color-mix(in srgb, var(--warning) 45%, transparent)",
              background: "color-mix(in srgb, var(--warning) 12%, transparent)",
              color: "color-mix(in srgb, var(--warning) 85%, var(--text))",
            }}
          >
            ⚠️ Selecciona una <strong>fecha</strong> en el formulario antes de
            abrir el preview.
          </div>
        )}

        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {/* Editor de filas */}
        <div className="ff-surface p-3 space-y-2">
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Escribe el <strong>total pagado (con ITBIS)</strong> por línea. La
            app calcula el neto.
          </div>

          {rows.map((r, idx) => {
            const item = items.find(
              (it) => String(it.id) === String(r.item_id)
            );

            return (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2"
                style={{
                  borderTop:
                    "var(--border-w) solid color-mix(in srgb, var(--border-rgba) 70%, transparent)",
                }}
              >
                <div className="sm:col-span-5 w-full">
                  <FFSelect
                    value={r.item_id}
                    onChange={(val, opt) => {
                      // Limpieza
                      if (!val) {
                        updateRow(idx, "item_id", "");
                        updateRow(idx, "gross_total", "");
                        updateRow(idx, "gross_touched", false);
                        return;
                      }

                      // Selección
                      updateRow(idx, "item_id", String(val));
                      updateRow(idx, "gross_touched", false);

                      const it =
                        opt || items.find((x) => String(x.id) === String(val));
                      if (it) {
                        const nextGross = computeGrossFromLatest(
                          it,
                          r.quantity
                        );
                        updateRow(idx, "gross_total", nextGross);
                      }
                    }}
                    options={items}
                    placeholder="Escribe para buscar artículo..."
                    searchable
                    clearable
                    maxVisible={50}
                    getOptionValue={(it) => it.id}
                    getOptionLabel={(it) => it.name}
                    renderOption={(it, { isActive, isDisabled }) => (
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{it.name}</span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          ({currency(it.latest_price)})
                        </span>
                      </div>
                    )}
                  />
                </div>

                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={r.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (Number(v) < 0) return; 
                    handleQtyChange(idx, v);
                  }}
                  placeholder="Cantidad"
                  className="ff-input sm:col-span-2"
                />

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={r.gross_total}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (Number(v) < 0) return; 
                    handleGrossChange(idx, v);
                  }}
                  placeholder="Total pagado"
                  className="ff-input sm:col-span-3"
                />

                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="ff-btn ff-btn-danger sm:col-span-2"
                >
                  Quitar
                </button>

                {item && (
                  <div
                    className="sm:col-span-12 text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    latest_price:{" "}
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>
                      {currency(item.latest_price)}
                    </span>{" "}
                    • ITBIS:{" "}
                    <span style={{ color: "var(--text)", fontWeight: 700 }}>
                      {item.is_exempt
                        ? "Exento"
                        : `${Number(item.tax_rate || 0)}%`}
                    </span>
                    <span
                      className="ml-2 text-[10px]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--muted) 70%, transparent)",
                      }}
                    >
                      {r.gross_touched ? "• Manual" : "• Auto"}
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
              className="ff-btn ff-btn-outline"
            >
              Agregar línea
            </button>

            <button
              type="button"
              disabled={!canPreview || loadingPreview}
              onClick={handlePreview}
              className={`ff-btn ${
                !canPreview || loadingPreview ? "" : "ff-btn-primary"
              }`}
              style={
                !canPreview || loadingPreview
                  ? {
                      opacity: 0.55,
                      cursor: "not-allowed",
                      boxShadow: "none",
                    }
                  : undefined
              }
            >
              {loadingPreview ? "Generando preview..." : "Preview"}
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview?.lines?.length > 0 && (
          <div className="ff-surface p-3 space-y-3">
            <div
              className="flex flex-wrap gap-3 text-xs"
              style={{ color: "var(--text)" }}
            >
              <span>
                Fecha: <span style={{ fontWeight: 700 }}>{preview.date}</span>
              </span>
              <span>
                Descuento:{" "}
                <span style={{ fontWeight: 700 }}>
                  {preview.discount || 0}%
                </span>
              </span>
              {previewTotals && (
                <>
                  <span>
                    Total (antes):{" "}
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>
                      {currency(previewTotals.totalBeforeDiscount)}
                    </span>
                  </span>
                  <span>
                    Total (con desc):{" "}
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>
                      {currency(previewTotals.totalAfterDiscount)}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div
              className="max-h-64 overflow-auto rounded-lg"
              style={{
                border: "var(--border-w) solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              }}
            >
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr
                    className="text-left border-b"
                    style={{
                      background:
                        "color-mix(in srgb, var(--panel) 85%, transparent)",
                      borderColor: "var(--border-rgba)",
                    }}
                  >
                    <th className="py-1 px-2" style={{ color: "var(--muted)" }}>
                      Artículo
                    </th>
                    <th
                      className="py-1 px-2 text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Cant
                    </th>
                    <th
                      className="py-1 px-2 text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Neto calc
                    </th>
                    <th
                      className="py-1 px-2 text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Existente día
                    </th>
                    <th
                      className="py-1 px-2 text-right"
                      style={{ color: "var(--muted)" }}
                    >
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
                        style={{
                          background:
                            i % 2 === 0
                              ? "color-mix(in srgb, var(--panel) 78%, transparent)"
                              : "color-mix(in srgb, var(--panel) 86%, transparent)",
                        }}
                      >
                        <td
                          className="py-1 px-2"
                          style={{ color: "var(--text)" }}
                        >
                          {it?.name || l.item_id}
                          <div
                            className="text-[10px]"
                            style={{ color: "var(--muted)" }}
                          >
                            latest: {currency(l.latest_price)} • ITBIS:{" "}
                            {l.is_exempt
                              ? "Exento"
                              : `${Number(l.tax_rate || 0)}%`}
                          </div>
                        </td>

                        <td
                          className="py-1 px-2 text-right"
                          style={{ color: "var(--text)" }}
                        >
                          {l.quantity}
                        </td>

                        <td
                          className="py-1 px-2 text-right"
                          style={{ color: "var(--success)", fontWeight: 700 }}
                        >
                          {currency(l.computed?.unit_price_net)}
                        </td>

                        <td
                          className="py-1 px-2 text-right"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 65%, var(--text))",
                            fontWeight: 700,
                          }}
                        >
                          {hasExisting
                            ? currency(l.existing_price_on_date)
                            : "—"}
                        </td>

                        <td className="py-1 px-2 text-right">
                          {isConflict ? (
                            <button
                              type="button"
                              onClick={() => toggleResolution(l.item_id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                              style={
                                l.resolution === "update_existing"
                                  ? {
                                      borderColor:
                                        "color-mix(in srgb, var(--success) 55%, var(--border-rgba))",
                                      background:
                                        "color-mix(in srgb, var(--success) 12%, transparent)",
                                      color: "var(--success)",
                                    }
                                  : {
                                      borderColor:
                                        "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))",
                                      background:
                                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                                      color: "var(--text)",
                                    }
                              }
                            >
                              {l.resolution === "update_existing"
                                ? "Actualizar"
                                : "Usar existente"}
                            </button>
                          ) : (
                            <span
                              className="text-[11px]"
                              style={{ color: "var(--muted)" }}
                            >
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
              <div className="text-xs" style={{ color: "var(--warning)" }}>
                ⚠️ Hay conflictos sin resolver.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={loadingCreate}
                onClick={handleCreate}
                className="ff-btn ff-btn-primary"
                style={
                  loadingCreate
                    ? { opacity: 0.65, cursor: "not-allowed" }
                    : undefined
                }
              >
                {loadingCreate ? "Creando..." : "Crear transacción"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="ff-btn ff-btn-outline"
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
