// src/components/reports/ExpenseDistributionByCategoryChart.jsx
import { useState, useMemo } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Modal from "../Modal";

// ✅ Paleta “tema-friendly” (usa tokens). Recharts acepta CSS vars en fill.
const COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "color-mix(in srgb, var(--primary) 55%, #4f46e5)", // indigo-ish
  "color-mix(in srgb, var(--primary) 45%, #3b82f6)", // blue-ish
  "color-mix(in srgb, var(--danger) 55%, #ec4899)",  // pink-ish
  "color-mix(in srgb, var(--primary) 35%, #14b8a6)", // teal-ish
  "color-mix(in srgb, var(--warning) 55%, #a855f7)", // violet-ish
  "color-mix(in srgb, var(--success) 55%, #0ea5e9)", // sky-ish
  "color-mix(in srgb, var(--primary) 30%, #84cc16)", // lime-ish
  "color-mix(in srgb, var(--danger) 35%, #f43f5e)",  // rose-ish
];

function ExpenseDistributionByCategoryChart({
  expensesByCategory = {},
  categoryNameMap = {},
  token,
}) {
  const api = import.meta.env.VITE_API_URL;

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pieData = useMemo(
    () =>
      Object.entries(expensesByCategory).map(([catId, value]) => ({
        categoryId: catId,
        name: categoryNameMap?.[catId] || `Categoría ${catId}`,
        value: Number(value || 0),
      })),
    [expensesByCategory, categoryNameMap]
  );

  const handleSliceClick = async (_, index) => {
    try {
      const slice = pieData[index];
      if (!slice) return;

      const catId = slice.categoryId;
      const catName = slice.name;

      setSelectedCategory(catName);

      const res = await axios.get(
        `${api}/dashboard/transactions-by-category?category_id=${catId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCategoryTransactions(res.data.data || []);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error al cargar transacciones:", err);
    }
  };

  if (!pieData.length) {
    return (
      <p className="text-sm italic" style={{ color: "var(--muted)" }}>
        No hay gastos registrados para el período actual.
      </p>
    );
  }

  return (
    <div className="space-y-3" style={{ color: "var(--text)" }}>
      {/* PieChart – mismo tamaño original */}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius="80%"
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(1)}%)`
              }
              onClick={handleSliceClick}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${entry.categoryId}-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Pie>

            {/* ✅ Tooltip tokenizado */}
            <Tooltip
              formatter={(value) => `RD$ ${Number(value || 0).toFixed(2)}`}
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

      <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        Este gráfico muestra el porcentaje del total de gastos del mes actual,
        distribuidos por categoría.{" "}
        <span style={{ color: "var(--heading-muted)" }}>
          Haz clic en una categoría para ver sus transacciones.
        </span>
      </p>

      {/* MODAL: ancho grande + sin scroll horizontal */}
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
                  py-2
                  border-b last:border-b-0
                  rounded-md
                  px-2 -mx-2
                  transition-colors
                "
                style={{
                  borderColor: "var(--border-rgba)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--panel) 70%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span className="w-20 shrink-0" style={{ color: "var(--muted)" }}>
                  {tx.date}
                </span>

                <span className="flex-1 truncate" style={{ color: "var(--text)" }}>
                  {tx.description || "Sin descripción"}
                </span>

                <span className="font-semibold shrink-0" style={{ color: "var(--danger)" }}>
                  RD$ {Number(tx.amount || 0).toFixed(2)}
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
