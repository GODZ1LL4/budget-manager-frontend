// src/components/reports/ExpenseDistributionByCategoryChart.jsx
import { useState, useMemo } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Modal from "../Modal";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f43f5e", "#a855f7", "#0ea5e9", "#84cc16",
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
        value,
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
    return <p className="text-sm text-slate-500 italic">No hay gastos registrados para el período actual.</p>;
  }

  return (
    <div className="space-y-3">

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
            <Tooltip
              formatter={(value) => `RD$ ${Number(value).toFixed(2)}`}
              labelFormatter={(label) => `Categoría: ${label}`}
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #4b5563",
                color: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
              }}
              itemStyle={{ color: "#e5e7eb" }}
              labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        Este gráfico muestra el porcentaje del total de gastos del mes actual,
        distribuidos por categoría.{" "}
        <span className="text-slate-400">
          Haz clic en una categoría para ver sus transacciones.
        </span>
      </p>

      {/* MODAL: ancho grande + sin scroll horizontal + fuente mínima sm */}
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
        <div
          className="
            space-y-2 
            max-h-96 
            overflow-y-auto 
            overflow-x-hidden 
            text-sm
            pr-1
          "
        >
          {categoryTransactions.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin transacciones registradas.
            </p>
          ) : (
            categoryTransactions.map((tx) => (
              <div
                key={tx.id}
                className="
                  flex items-center justify-between gap-3
                  py-2
                  border-b border-slate-800 last:border-b-0
                  text-sm
                  text-slate-200
                  hover:bg-slate-900/70
                  rounded-md
                  px-2 -mx-2
                  transition-colors
                "
              >
                <span className="text-slate-400 w-20 shrink-0">
                  {tx.date}
                </span>

                <span className="flex-1 truncate text-slate-200">
                  {tx.description || "Sin descripción"}
                </span>

                <span className="font-semibold text-rose-400 shrink-0">
                  RD$ {parseFloat(tx.amount).toFixed(2)}
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
