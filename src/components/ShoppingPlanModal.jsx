import { useEffect, useMemo, useState } from "react";
import {
  HiClipboard,
  HiDownload,
  HiPlus,
  HiShare,
  HiTrash,
} from "react-icons/hi";
import { toast } from "react-toastify";
import FFSelect from "./FFSelect";
import Modal from "./Modal";
import { todayDateKey } from "../lib/dates/localDate";

function parseNumber(value, fallback = 0) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getGrossUnitPrice(item) {
  if (!item || item.latest_price == null) return 0;
  const net = Number(item.latest_price || 0);
  const taxRate = item.is_exempt ? 0 : Number(item.tax_rate || 0);
  return round2(net * (1 + taxRate / 100));
}

function createInitialRows(items, selectedIds) {
  const selected = (selectedIds || [])
    .map((id) => items.find((item) => String(item.id) === String(id)))
    .filter(Boolean)
    .map((item) => ({ item_id: String(item.id), quantity: "1" }));

  return selected.length > 0 ? selected : [{ item_id: "", quantity: "1" }];
}

function buildTextExport(lines, total, date) {
  const body = lines.map(
    (line, index) =>
      `${index + 1}. ${line.name} - Cant: ${line.quantity} x ${formatCurrency(
        line.unit_price
      )} = ${formatCurrency(line.total)}`
  );

  return [
    `Lista de compra - ${date}`,
    "",
    ...body,
    "",
    `Total estimado: ${formatCurrency(total)}`,
  ].join("\n");
}

function buildCsvExport(lines, total, date) {
  const header = [
    "fecha",
    "articulo",
    "cantidad",
    "precio_unitario_estimado",
    "total_articulo",
  ];
  const rows = lines.map((line) =>
    [
      escapeCsv(date),
      escapeCsv(line.name),
      escapeCsv(line.quantity),
      escapeCsv(line.unit_price.toFixed(2)),
      escapeCsv(line.total.toFixed(2)),
    ].join(";")
  );

  rows.push(
    [
      escapeCsv(date),
      escapeCsv("TOTAL"),
      escapeCsv(""),
      escapeCsv(""),
      escapeCsv(total.toFixed(2)),
    ].join(";")
  );

  return [header.map(escapeCsv).join(";"), ...rows].join("\n");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function ShoppingPlanModal({
  isOpen,
  onClose,
  items,
  selectedIds = [],
}) {
  const [rows, setRows] = useState([{ item_id: "", quantity: "1" }]);
  const date = todayDateKey();

  useEffect(() => {
    if (!isOpen) return;
    setRows(createInitialRows(items, selectedIds));
  }, [isOpen, items, selectedIds]);

  const lines = useMemo(() => {
    return rows
      .map((row) => {
        const item = items.find((entry) => String(entry.id) === String(row.item_id));
        const quantity = parseNumber(row.quantity, 0);
        const unitPrice = getGrossUnitPrice(item);
        return {
          item_id: row.item_id,
          name: item?.name || "",
          category: item?.category || "",
          quantity,
          unit_price: unitPrice,
          total: round2(unitPrice * quantity),
          has_price: item?.latest_price != null,
          tax_label: item?.is_exempt
            ? "Exento"
            : item?.tax_rate != null
            ? `${Number(item.tax_rate || 0)}%`
            : "Sin impuesto",
        };
      })
      .filter((line) => line.item_id && line.quantity > 0);
  }, [items, rows]);

  const total = useMemo(
    () => round2(lines.reduce((sum, line) => sum + line.total, 0)),
    [lines]
  );

  const canExport = lines.length > 0;
  const textExport = useMemo(
    () => buildTextExport(lines, total, date),
    [date, lines, total]
  );
  const csvExport = useMemo(
    () => buildCsvExport(lines, total, date),
    [date, lines, total]
  );

  const addRow = () => {
    setRows((prev) => [...prev, { item_id: "", quantity: "1" }]);
  };

  const updateRow = (index, patch) => {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  };

  const removeRow = (index) => {
    setRows((prev) => {
      const next = prev.filter((_, rowIndex) => rowIndex !== index);
      return next.length ? next : [{ item_id: "", quantity: "1" }];
    });
  };

  const copyList = async () => {
    if (!canExport) return;

    try {
      await navigator.clipboard?.writeText(textExport);
      toast.success("Lista copiada");
    } catch {
      toast.error("No se pudo copiar la lista");
    }
  };

  const shareList = async () => {
    if (!canExport) return;

    if (!navigator.share) {
      await copyList();
      return;
    }

    try {
      await navigator.share({
        title: `Lista de compra ${date}`,
        text: textExport,
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("No se pudo compartir la lista");
      }
    }
  };

  const downloadText = () => {
    if (!canExport) return;
    downloadFile(
      textExport,
      `lista-compra-${date}.txt`,
      "text/plain;charset=utf-8;"
    );
  };

  const downloadCsv = () => {
    if (!canExport) return;
    downloadFile(csvExport, `lista-compra-${date}.csv`, "text/csv;charset=utf-8;");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Plan de compra" size="xl">
      <div className="space-y-4">
        <div className="space-y-3">
          {rows.map((row, index) => {
            const item = items.find(
              (entry) => String(entry.id) === String(row.item_id)
            );
            const quantity = parseNumber(row.quantity, 0);
            const unitPrice = getGrossUnitPrice(item);
            const lineTotal = round2(unitPrice * quantity);

            return (
              <div
                key={`${row.item_id || "row"}-${index}`}
                className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_110px_130px_auto]"
                style={{
                  borderColor: "var(--border-rgba)",
                  background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                }}
              >
                <div className="min-w-0">
                  <label className="ff-label mb-1 block">Articulo</label>
                  <FFSelect
                    value={row.item_id}
                    onChange={(value) =>
                      updateRow(index, { item_id: value ? String(value) : "" })
                    }
                    options={items}
                    placeholder="Buscar articulo..."
                    searchable
                    clearable
                    maxVisible={50}
                    getOptionValue={(entry) => entry.id}
                    getOptionLabel={(entry) => entry.name}
                    renderOption={(entry) => (
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{entry.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {entry.latest_price == null
                            ? "Sin precio"
                            : formatCurrency(getGrossUnitPrice(entry))}
                        </span>
                      </div>
                    )}
                  />
                </div>

                <div>
                  <label className="ff-label mb-1 block">Cantidad</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(index, { quantity: event.target.value })
                    }
                    className="ff-input"
                    placeholder="1"
                  />
                </div>

                <div>
                  <label className="ff-label mb-1 block">Total articulo</label>
                  <div
                    className="flex h-10 items-center rounded-[var(--control-radius)] border px-3 text-sm font-semibold"
                    style={{
                      borderColor: "var(--control-border)",
                      background: "var(--control-bg)",
                      color: "var(--success)",
                    }}
                  >
                    {formatCurrency(lineTotal)}
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="ff-btn ff-btn-danger h-10 w-full sm:w-10"
                    aria-label="Quitar articulo"
                    title="Quitar articulo"
                  >
                    <HiTrash />
                  </button>
                </div>

                {item && (
                  <div className="text-xs text-[var(--muted)] sm:col-span-4">
                    Unitario estimado:{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {formatCurrency(unitPrice)}
                    </span>{" "}
                    - ITBIS: {item.is_exempt ? "Exento" : `${Number(item.tax_rate || 0)}%`}
                    {item.latest_price == null && (
                      <span className="ml-2 text-[var(--warning)]">
                        Sin precio registrado
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={addRow} className="ff-btn ff-btn-outline">
            <HiPlus />
            Agregar articulo
          </button>

          <div
            className="rounded-lg border px-4 py-3 text-right"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 82%, transparent)",
            }}
          >
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">
              Total estimado
            </div>
            <div className="text-2xl font-extrabold text-[var(--success)]">
              {formatCurrency(total)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={shareList}
            disabled={!canExport}
            className="ff-btn ff-btn-primary"
          >
            <HiShare />
            Compartir
          </button>
          <button
            type="button"
            onClick={copyList}
            disabled={!canExport}
            className="ff-btn ff-btn-outline"
          >
            <HiClipboard />
            Copiar
          </button>
          <button
            type="button"
            onClick={downloadText}
            disabled={!canExport}
            className="ff-btn ff-btn-outline"
          >
            <HiDownload />
            TXT
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!canExport}
            className="ff-btn ff-btn-outline"
          >
            <HiDownload />
            CSV
          </button>
        </div>
      </div>
    </Modal>
  );
}
