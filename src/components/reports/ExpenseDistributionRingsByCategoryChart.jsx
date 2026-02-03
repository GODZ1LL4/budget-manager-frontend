import { useMemo, useState } from "react";
import axios from "axios";
import ReactECharts from "echarts-for-react";
import Modal from "../Modal";

const COLORS = [
  "#22D3EE", "#FFD37A", "#FB7185", "#D6A43A",
  "#60A5FA", "#A78BFA", "#34D399", "#F59E0B",
  "#F472B6", "#38BDF8", "#C084FC", "#F43F5E",
  "#2DD4BF", "#A3E635", "#E879F9", "#93C5FD",
];

const money = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

const safeNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

export default function ExpenseDistributionRingsByCategoryChart({
  expensesByCategory = {},
  categoryNameMap = {},
  token,
}) {
  const api = import.meta.env.VITE_API_URL;

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const rows = useMemo(() => {
    const list = Object.entries(expensesByCategory)
      .map(([catId, value]) => ({
        categoryId: catId,
        name: categoryNameMap?.[catId] || `Categoría ${catId}`,
        value: safeNum(value),
      }))
      .filter((r) => r.value > 0);

    list.sort((a, b) => b.value - a.value);

    const total = list.reduce((a, r) => a + r.value, 0);

    return {
      total,
      items: list.map((r) => ({
        ...r,
        pct: total > 0 ? (r.value / total) * 100 : 0,
      })),
    };
  }, [expensesByCategory, categoryNameMap]);

  const option = useMemo(() => {
    if (!rows.items.length) return null;

    // Anillos estilo “metas deportivas”
    const rings = rows.items;

    const innerStart = 18;
    const baseRadius = 86;
    const ringCount = rings.length;
    
    const maxThicknessBudget = Math.max(14, baseRadius - innerStart);
    
    // grosor base
    let thickness = Math.floor(maxThicknessBudget / (ringCount * 1.15));
    thickness = Math.max(4, Math.min(12, thickness));
    
    // gap
    let gap = Math.floor(thickness * 0.25);
    gap = Math.max(1, Math.min(3, gap));
    
    // si hay pocas categorías, más grueso
    if (ringCount <= 8) {
      thickness = Math.max(6, Math.min(16, thickness + 3));
      gap = Math.max(1, Math.min(3, gap));
    } else if (ringCount <= 14) {
      thickness = Math.max(5, Math.min(14, thickness + 2));
    }
    

    const series = rings.map((r, i) => {
      const outer = baseRadius - i * (thickness + gap);
      const inner = outer - thickness;

      const color = COLORS[i % COLORS.length];

      return {
        name: r.name,
        type: "pie",
        radius: [`${inner}%`, `${outer}%`],
        center: ["42%", "55%"],
        startAngle: 90,
        clockwise: true,
        silent: false,
        label: { show: false },
        emphasis: { scale: false },
        data: [
          {
            value: r.pct,
            name: r.name,
            itemStyle: {
              color,
              shadowBlur: 14,
              shadowColor: "rgba(0,0,0,0.55)",
            },
            categoryId: r.categoryId,
          },
          {
            value: Math.max(0, 100 - r.pct),
            name: "Restante",
            itemStyle: { color: "rgba(255,255,255,0.06)" },
            tooltip: { show: false },
          },
        ],
      };
    });

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      tooltip: {
        trigger: "item",
        appendToBody: true,
        confine: false,
        renderMode: "html",
        extraCssText:
          "z-index:2147483647; box-shadow:0 18px 45px rgba(0,0,0,0.90); border-radius:12px; border:1px solid rgba(255,215,128,0.18);",
        formatter: (p) => {
          const name = p?.name || "";
          if (!name || name === "Restante") return "";
          const ring = rows.items.find((x) => x.name === name);
          if (!ring) return "";
          return `
            <div style="padding:10px 12px; color: rgba(255,255,255,0.92); background:#020617;">
              <div style="font-weight:900; margin-bottom:4px;">${ring.name}</div>
              <div style="opacity:0.85;">${ring.pct.toFixed(1)}% del gasto del mes</div>
              <div style="margin-top:6px; font-weight:900;">${money(ring.value)}</div>
              <div style="opacity:0.70; margin-top:4px;">Clic para ver transacciones</div>
            </div>
          `;
        },
      },
      graphic: [
        {
          type: "text",
          left: "42%",
          top: "40%",
          style: {
            text: "Total gastos",
            fill: "rgba(255,255,255,0.72)",
            fontSize: 12,
            fontWeight: 800,
          },
        },
        {
          type: "text",
          left: "42%",
          top: "47%",
          style: {
            text: money(rows.total),
            fill: "rgba(255,255,255,0.92)",
            fontSize: 16,
            fontWeight: 900,
          },
        },
        {
          type: "text",
          left: "42%",
          top: "56%",
          style: {
            text: ringCount > 18 ? "Muchas categorías (anillos compactos)" : "Mes actual",
            fill: "rgba(255,215,128,0.85)",
            fontSize: 11,
            fontWeight: 800,
          },
        },
      ],
      series,
    };
  }, [rows]);

  const onEvents = useMemo(
    () => ({
      click: async (params) => {
        try {
          const clickedName = params?.name;
          if (!clickedName || clickedName === "Restante") return;

          const catId = params?.data?.categoryId;
          if (!catId) return;

          setSelectedCategory(clickedName);

          const res = await axios.get(
            `${api}/dashboard/transactions-by-category?category_id=${catId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setCategoryTransactions(res?.data?.data || []);
          setIsModalOpen(true);
        } catch (err) {
          console.error("Error al cargar transacciones:", err);
        }
      },
    }),
    [api, token]
  );

  if (!rows.items.length) {
    return (
      <p className="text-sm text-slate-200/70 italic">
        No hay gastos registrados para el período actual.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-full" style={{ height: 360 }}>
        <ReactECharts option={option} style={{ height: "100%" }} onEvents={onEvents} />
      </div>

      {/* Leyenda completa (universo completo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {rows.items.map((r, i) => (
          <div
            key={`${r.categoryId}-${i}`}
            className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
            style={{
              borderColor: "rgba(255,215,128,0.14)",
              background: "rgba(0,0,0,0.14)",
            }}
            title={r.name}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-sm text-slate-100 truncate">{r.name}</span>
              <span className="text-xs text-slate-300/70 shrink-0">{r.pct.toFixed(1)}%</span>
            </div>
            <span className="text-sm font-semibold text-slate-100 shrink-0">{money(r.value)}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-200/75 leading-relaxed">
        Cada anillo representa una categoría y su porcentaje del total de gastos del mes.
        <span className="text-slate-300/70"> Haz clic en un anillo para ver transacciones.</span>
      </p>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCategory(null);
          setCategoryTransactions([]);
        }}
        title={selectedCategory ? `Transacciones: ${selectedCategory}` : "Transacciones por categoría"}
        size="lg"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden text-sm pr-1">
          {categoryTransactions.length === 0 ? (
            <p className="text-sm text-slate-300/80">Sin transacciones registradas.</p>
          ) : (
            categoryTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-b-0 text-sm text-slate-200 hover:bg-slate-900/70 rounded-md px-2 -mx-2 transition-colors"
              >
                <span className="text-slate-300/70 w-20 shrink-0">{tx.date}</span>
                <span className="flex-1 truncate text-slate-100">
                  {tx.description || "Sin descripción"}
                </span>
                <span className="font-semibold text-rose-300 shrink-0">
                  {money(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
 