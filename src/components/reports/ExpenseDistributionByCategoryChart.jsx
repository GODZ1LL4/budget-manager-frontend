// src/components/reports/ExpenseDistributionByCategoryChart.jsx
import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Modal from "../Modal";

// ✅ Paleta “tema-friendly” (usa tokens). Recharts acepta CSS vars en fill.
const COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "color-mix(in srgb, var(--primary) 55%, #4f46e5)",
  "color-mix(in srgb, var(--primary) 45%, #3b82f6)",
  "color-mix(in srgb, var(--danger) 55%, #ec4899)",
  "color-mix(in srgb, var(--primary) 35%, #14b8a6)",
  "color-mix(in srgb, var(--warning) 55%, #a855f7)",
  "color-mix(in srgb, var(--success) 55%, #0ea5e9)",
  "color-mix(in srgb, var(--primary) 30%, #84cc16)",
  "color-mix(in srgb, var(--danger) 35%, #f43f5e)",
];

const money = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

const safeNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

function ExpenseDistributionByCategoryChart({
  expensesByCategory = {},
  categoryNameMap = {},
  token,
}) {
  const api = import.meta.env.VITE_API_URL;

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Igual que el reporte de anillos: lista, total, % y ordenado
  const rows = useMemo(() => {
    const list = Object.entries(expensesByCategory)
      .map(([catId, value]) => ({
        categoryId: catId,
        name: categoryNameMap?.[catId] || `Categoría ${catId}`,
        value: safeNum(value),
      }))
      .filter((r) => r.value > 0);

    list.sort((a, b) => b.value - a.value);

    const total = list.reduce((acc, r) => acc + r.value, 0);

    return {
      total,
      items: list.map((r) => ({
        ...r,
        pct: total > 0 ? (r.value / total) * 100 : 0,
      })),
    };
  }, [expensesByCategory, categoryNameMap]);

  // ✅ Misma acción para slice y card
  const openCategory = useCallback(
    async (catId, catName) => {
      try {
        if (!catId) return;

        setSelectedCategory(catName || "Categoría");
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
    [api, token]
  );

  // ✅ Click en slice (Recharts manda (data, index))
  const handleSliceClick = (_, index) => {
    const slice = rows.items[index];
    if (!slice) return;
    openCategory(slice.categoryId, slice.name);
  };

  if (!rows.items.length) {
    return (
      <p className="text-sm italic" style={{ color: "var(--muted)" }}>
        No hay gastos registrados para el período actual.
      </p>
    );
  }

  return (
    <div className="space-y-3" style={{ color: "var(--text)" }}>
      {/* PieChart */}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={rows.items}
              dataKey="value"
              nameKey="name"
              outerRadius="80%"
              // Si quieres evitar labels largos, pon label={false}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(1)}%)`
              }
              onClick={handleSliceClick}
            >
              {rows.items.map((entry, index) => (
                <Cell
                  key={`cell-${entry.categoryId}-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) => [money(value), "Gasto"]}
              labelFormatter={(label) => `Categoría: ${label}`}
              contentStyle={{
                background: "color-mix(in srgb, var(--bg-3) 78%, transparent)",
                border: "1px solid var(--border-rgba)",
                color: "var(--text)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                padding: "10px 12px",
                backdropFilter: "blur(10px)",
              }}
              itemStyle={{ color: "var(--text)" }}
              labelStyle={{ color: "var(--heading)", fontWeight: 700 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ✅ Mini cards por categoría (clic abre modal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {rows.items.map((r, i) => (
          <button
            type="button"
            key={`${r.categoryId}-${i}`}
            className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 55%, transparent)",
              cursor: "pointer",
            }}
            title={r.name}
            onClick={() => openCategory(r.categoryId, r.name)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "color-mix(in srgb, var(--panel) 78%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "color-mix(in srgb, var(--panel) 55%, transparent)";
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span
                className="text-sm truncate"
                style={{ color: "var(--text)" }}
              >
                {r.name}
              </span>
              <span
                className="text-xs shrink-0"
                style={{ color: "var(--muted)" }}
              >
                {r.pct.toFixed(1)}%
              </span>
            </div>

            <span
              className="text-sm font-semibold shrink-0"
              style={{ color: "var(--text)" }}
            >
              {money(r.value)}
            </span>
          </button>
        ))}
      </div>

      <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        Este gráfico muestra el porcentaje del total de gastos del mes actual,
        distribuidos por categoría.{" "}
        <span style={{ color: "var(--heading-muted)" }}>
          Haz clic en una categoría (slice o card) para ver sus transacciones.
        </span>
      </p>

      {/* MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCategory(null);
          setCategoryTransactions([]);
        }}
        title={
          selectedCategory
            ? `Transacciones: ${selectedCategory}`
            : "Transacciones por categoría"
        }
        size="lg"
      >
        <div
          className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden text-sm pr-1"
          style={{ color: "var(--text)" }}
        >
          {categoryTransactions.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Sin transacciones registradas.
            </p>
          ) : (
            categoryTransactions.map((tx) => (
              <div
                key={tx.id}
                className="
                  flex items-center justify-between gap-3
                  py-2 border-b last:border-b-0
                  rounded-md px-2 -mx-2
                  transition-colors
                "
                style={{ borderColor: "var(--border-rgba)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--panel) 70%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="w-20 shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {tx.date}
                </span>

                <span
                  className="flex-1 truncate"
                  style={{ color: "var(--text)" }}
                >
                  {tx.description || "Sin descripción"}
                </span>

                <span
                  className="font-semibold shrink-0"
                  style={{ color: "var(--danger)" }}
                >
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

export default ExpenseDistributionByCategoryChart;
