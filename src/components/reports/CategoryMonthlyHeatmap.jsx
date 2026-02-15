import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const MONTH_LABELS = {
  "01": "Ene",
  "02": "Feb",
  "03": "Mar",
  "04": "Abr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dic",
};

function monthLabel(m) {
  const [y, mm] = String(m || "").split("-");
  return `${MONTH_LABELS[mm] || mm || ""} ${y || ""}`.trim();
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

// Versión corta para mostrar dentro de la celda
function formatShortCurrency(value) {
  const num = Number(value) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return `${num.toFixed(0)}`;
}

// Mapea intensidad [0,1] a un color entre success -> danger (tokens)
function mixSuccessDanger(intensity) {
  const t = Math.max(0, Math.min(1, Number(intensity) || 0));
  // 0 => success; 1 => danger
  return `color-mix(in srgb, var(--success) ${Math.round(
    (1 - t) * 100
  )}%, var(--danger))`;
}

function p90ScaleMax(values) {
  const arr = (values || []).filter((v) => Number(v) > 0).map(Number);
  if (arr.length === 0) return 0;
  arr.sort((a, b) => a - b);
  const idx = Math.floor(arr.length * 0.9) - 1; // p90
  const p90 = arr[Math.max(0, idx)];
  const max = arr[arr.length - 1];
  return p90 || max || 0;
}

function CategoryMonthlyHeatmap({ token }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const api = import.meta.env.VITE_API_URL;

  // ===== Tokenized UI =====
  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const cardBg =
      "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))";
    const headerBg = "color-mix(in srgb, var(--panel-2) 75%, var(--bg-3))";
    const rowA = "color-mix(in srgb, var(--bg-3) 82%, transparent)";
    const rowB = "color-mix(in srgb, var(--bg-2) 82%, transparent)";
    const totalBg = "color-mix(in srgb, var(--panel-2) 82%, var(--bg-3))";

    return {
      card: {
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${border}`,
        background: cardBg,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      },
      border,
      headerBg,
      rowA,
      rowB,
      totalBg,
      text: "var(--text)",
      muted: "var(--muted)",
      cellText: "var(--text)",
      // celdas heatmap
      heatFill: (t) => mixSuccessDanger(t),
      // borde/outline del heatmap
      cellBorder: `1px solid color-mix(in srgb, var(--border-rgba) 75%, transparent)`,
      // (opcional) aclarar el color conforme aumenta para legibilidad
      heatOverlay: (t) =>
        `color-mix(in srgb, #ffffff ${Math.round(t * 10)}%, transparent)`,
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/category-month-heatmap`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setRows(res.data?.data || []);
        setMeta(res.data?.meta || null);
      })
      .catch((err) =>
        console.error("Error cargando heatmap categoría-mes:", err)
      );
  }, [token, api]);

  const { categories, months, matrix, scaleMax, monthTotals } = useMemo(() => {
    const catMap = new Map();
    const monthSet = new Set();
    const allAmounts = [];

    (rows || []).forEach((r) => {
      if (!catMap.has(r.category_id)) {
        catMap.set(r.category_id, r.category_name);
      }
      monthSet.add(r.month);
      const amt = Number(r.amount) || 0;
      if (amt > 0) allAmounts.push(amt);
    });

    const categories = Array.from(catMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const months = Array.from(monthSet).sort((a, b) =>
      String(a).localeCompare(String(b))
    );

    const matrix = {};
    categories.forEach((c) => {
      matrix[c.id] = {};
      months.forEach((m) => {
        matrix[c.id][m] = 0;
      });
    });

    (rows || []).forEach((r) => {
      if (!matrix[r.category_id]) matrix[r.category_id] = {};
      matrix[r.category_id][r.month] =
        (matrix[r.category_id][r.month] || 0) + (Number(r.amount) || 0);
    });

    const scaleMax = p90ScaleMax(allAmounts);

    const monthTotals = {};
    months.forEach((m) => {
      monthTotals[m] = 0;
    });

    categories.forEach((cat) => {
      months.forEach((m) => {
        monthTotals[m] += Number(matrix[cat.id]?.[m] || 0);
      });
    });

    return { categories, months, matrix, scaleMax, monthTotals };
  }, [rows]);

  const gridCols = useMemo(
    () => `190px repeat(${months.length}, minmax(52px, 1fr))`,
    [months.length]
  );

  return (
    <div className="rounded-2xl p-6 space-y-4 overflow-hidden" style={ui.card}>
      {/* Header opcional */}
      {/* <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-wide" style={{ color: ui.text }}>
          Heatmap Categoría vs Mes {meta?.year ? `(${meta.year})` : ""}
        </h3>
      </div> */}

      {categories.length === 0 || months.length === 0 ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          No hay datos suficientes para mostrar el heatmap.
        </p>
      ) : (
        <>
          <div
            className="overflow-auto rounded-xl"
            style={{ border: `1px solid ${ui.border}` }}
          >
            <div className="grid" style={{ gridTemplateColumns: gridCols }}>
              {/* Cabecera vacía + meses */}
              <div
                style={{
                  background: ui.headerBg,
                  borderBottom: ui.cellBorder,
                }}
              />

              {months.map((m) => (
                <div
                  key={m}
                  className="px-1 py-2 text-[11px] text-center"
                  style={{
                    background: ui.headerBg,
                    borderBottom: ui.cellBorder,
                    color: ui.muted,
                  }}
                >
                  {monthLabel(m)}
                </div>
              ))}

              {/* Filas por categoría */}
              {categories.map((cat, rowIdx) => {
                const rowBg = rowIdx % 2 === 0 ? ui.rowA : ui.rowB;

                return (
                  <React.Fragment key={cat.id}>
                    <div
                      className="px-3 py-1.5 text-xs flex items-center"
                      style={{
                        background: rowBg,
                        borderTop: ui.cellBorder,
                        color: ui.text,
                      }}
                    >
                      {cat.name}
                    </div>

                    {months.map((m) => {
                      const amount = Number(matrix[cat.id]?.[m] || 0);

                      const intensity =
                        scaleMax > 0 ? Math.min(amount / scaleMax, 1) : 0;

                      const bg =
                        amount > 0 ? ui.heatFill(intensity) : "transparent";

                      // pequeño overlay para legibilidad (muy sutil)
                      const overlay =
                        amount > 0 ? ui.heatOverlay(intensity) : "transparent";

                      return (
                        <div
                          key={`${cat.id}-${m}`}
                          className="h-7 flex items-center justify-center"
                          style={{
                            background: rowBg,
                            borderTop: ui.cellBorder,
                            borderLeft: ui.cellBorder,
                            position: "relative",
                          }}
                          title={
                            amount > 0
                              ? `${cat.name} · ${monthLabel(m)}\n${formatCurrency(
                                  amount
                                )}`
                              : `${cat.name} · ${monthLabel(m)}\nSin gasto`
                          }
                        >
                          {/* capa color heatmap */}
                          {amount > 0 ? (
                            <div
                              aria-hidden
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: bg,
                                opacity: 0.9,
                              }}
                            />
                          ) : null}

                          {/* overlay de brillo */}
                          {amount > 0 ? (
                            <div
                              aria-hidden
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: overlay,
                                opacity: 0.35,
                              }}
                            />
                          ) : null}

                          <span
                            className="text-[11px] font-semibold"
                            style={{
                              position: "relative",
                              zIndex: 1,
                              color: ui.cellText,
                              textShadow:
                                "0 1px 0 rgba(0,0,0,0.35), 0 0 14px rgba(0,0,0,0.35)",
                            }}
                          >
                            {amount > 0 ? formatShortCurrency(amount) : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* TOTAL por mes (NEUTRO, sin heatmap) */}
              <div
                className="px-3 py-2 text-xs font-bold flex items-center"
                style={{
                  background: ui.totalBg,
                  borderTop: ui.cellBorder,
                  color: ui.text,
                }}
              >
                TOTAL
              </div>

              {months.map((m) => {
                const amount = Number(monthTotals[m] || 0);

                return (
                  <div
                    key={`total-${m}`}
                    className="h-8 flex items-center justify-center"
                    style={{
                      background: ui.totalBg,
                      borderTop: ui.cellBorder,
                      borderLeft: ui.cellBorder,
                    }}
                    title={
                      amount > 0
                        ? `TOTAL · ${monthLabel(m)}\n${formatCurrency(amount)}`
                        : `TOTAL · ${monthLabel(m)}\nSin gasto`
                    }
                  >
                    <span
                      className="text-[12px] font-extrabold"
                      style={{ color: ui.text }}
                    >
                      {amount > 0 ? formatShortCurrency(amount) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leyenda tokenizada */}
          <div
            className="flex items-center gap-3 text-[11px]"
            style={{ color: ui.muted }}
          >
            <span>Menos gasto</span>
            <div
              className="flex-1 h-2 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--success), var(--warning), var(--danger))",
                border: `1px solid color-mix(in srgb, var(--border-rgba) 65%, transparent)`,
              }}
            />
            <span>Más gasto</span>
          </div>

          {/* meta opcional */}
          {meta?.year ? (
            <div className="text-[11px]" style={{ color: ui.muted }}>
              Año: <span style={{ color: ui.text, fontWeight: 600 }}>{meta.year}</span> ·
              Escala (p90):{" "}
              <span style={{ color: ui.text, fontWeight: 600 }}>
                {formatCurrency(scaleMax)}
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default CategoryMonthlyHeatmap;
