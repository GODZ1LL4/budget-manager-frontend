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
  const [y, mm] = m.split("-");
  return `${MONTH_LABELS[mm] || mm} ${y}`;
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

// Mapea intensidad [0,1] a color HSL de verde (120) a rojo (0)
function greenToRed(intensity) {
  const clamped = Math.max(0, Math.min(1, intensity || 0));
  const hue = (1 - clamped) * 120; // 120 = verde, 0 = rojo
  const lightness = 18 + clamped * 12; // un poco más claro al subir
  return `hsl(${hue}, 80%, ${lightness}%)`;
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

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/category-month-heatmap`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setRows(res.data.data || []);
        setMeta(res.data.meta || null);
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
      .sort((a, b) => a.name.localeCompare(b.name));

    const months = Array.from(monthSet).sort((a, b) => a.localeCompare(b));

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

    // Escala relativa por percentil 90
    const scaleMax = p90ScaleMax(allAmounts);

    // ✅ Totales por mes (sumando todas las categorías)
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

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4 overflow-hidden">
      {/* Header opcional si quieres mostrar año */}
      {/* <div className="flex items-center justify-between">
        <h3 className="text-slate-200 font-semibold tracking-wide">
          Heatmap Categoría vs Mes {meta?.year ? `(${meta.year})` : ""}
        </h3>
      </div> */}

      {categories.length === 0 || months.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para mostrar el heatmap.
        </p>
      ) : (
        <>
          <div className="overflow-auto border border-slate-800 rounded-xl">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `190px repeat(${months.length}, minmax(52px, 1fr))`,
              }}
            >
              {/* Cabecera vacía + meses */}
              <div className="bg-slate-900/80 border-b border-slate-800" />
              {months.map((m) => (
                <div
                  key={m}
                  className="bg-slate-900/80 border-b border-slate-800 px-1 py-2 text-[11px] text-center text-slate-300"
                >
                  {monthLabel(m)}
                </div>
              ))}

              {/* Filas por categoría */}
              {categories.map((cat, rowIdx) => {
                const rowBg =
                  rowIdx % 2 === 0 ? "bg-slate-950/70" : "bg-slate-900/70";

                return (
                  <React.Fragment key={cat.id}>
                    <div
                      className={`${rowBg} border-t border-slate-800 px-3 py-1.5 text-xs text-slate-200 flex items-center`}
                    >
                      {cat.name}
                    </div>

                    {months.map((m) => {
                      const amount = matrix[cat.id]?.[m] || 0;

                      const intensity =
                        scaleMax > 0 ? Math.min(amount / scaleMax, 1) : 0;

                      const bgColor =
                        amount > 0 ? greenToRed(intensity) : "transparent";

                      return (
                        <div
                          key={`${cat.id}-${m}`}
                          className={`${rowBg} border-t border-l border-slate-800 h-7 flex items-center justify-center`}
                          style={{ backgroundColor: bgColor }}
                          title={
                            amount > 0
                              ? `${cat.name} · ${monthLabel(
                                  m
                                )}\n${formatCurrency(amount)}`
                              : `${cat.name} · ${monthLabel(m)}\nSin gasto`
                          }
                        >
                          <span className="text-[11px] font-semibold text-slate-50">
                            {amount > 0 ? formatShortCurrency(amount) : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* ✅ Fila TOTAL por mes (NEUTRA, sin heatmap) */}
              <div className="bg-slate-900 border-t border-slate-700 px-3 py-2 text-xs text-slate-100 font-bold flex items-center">
                TOTAL
              </div>

              {months.map((m) => {
                const amount = Number(monthTotals[m] || 0);

                return (
                  <div
                    key={`total-${m}`}
                    className="bg-slate-900 border-t border-l border-slate-700 h-8 flex items-center justify-center"
                    title={
                      amount > 0
                        ? `TOTAL · ${monthLabel(m)}\n${formatCurrency(amount)}`
                        : `TOTAL · ${monthLabel(m)}\nSin gasto`
                    }
                  >
                    <span className="text-[12px] font-extrabold text-slate-100">
                      {amount > 0 ? formatShortCurrency(amount) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leyenda verde → rojo (aplica solo a categorías, no a TOTAL) */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Menos gasto</span>
            <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500" />
            <span>Más gasto</span>
          </div>
        </>
      )}
    </div>
  );
}

export default CategoryMonthlyHeatmap;
