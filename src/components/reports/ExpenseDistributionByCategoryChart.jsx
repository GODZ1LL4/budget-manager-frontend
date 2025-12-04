// src/components/reports/ExpenseDistributionByCategoryChart.jsx
import { useState, useMemo } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Modal from "../Modal";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
  "#a855f7",
  "#0ea5e9",
  "#84cc16",
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
      const catId = pieData[index].categoryId;
      const catName = pieData[index].name;

      setSelectedCategory(catName);

      const res = await axios.get(
        `${api}/dashboard/transactions-by-category?category_id=${catId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCategoryTransactions(res.data.data || []);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error al cargar transacciones de categoría:", err);
    }
  };

  if (!pieData.length) {
    return (
      <p className="text-sm text-gray-500">
        No hay gastos registrados para el período actual.
      </p>
    );
  }

  return (
    <div>
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
              }}
              itemStyle={{ color: "#e5e7eb" }}
              labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm text-slate-200 mt-2">
        Este gráfico muestra el porcentaje del total de gastos del mes actual,
        distribuidos por categoría. Haz click en una categoría para ver sus
        transacciones.
      </p>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Transacciones: ${selectedCategory || ""}`}
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {categoryTransactions.length === 0 ? (
            <p className="text-sm text-gray-600">
              Sin transacciones registradas.
            </p>
          ) : (
            categoryTransactions.map((tx) => (
              <div
                key={tx.id}
                className="border-b pb-1 text-sm flex justify-between text-gray-700"
              >
                <span>{tx.date}</span>
                <span className="text-right truncate w-32">
                  {tx.description || "Sin descripción"}
                </span>
                <span className="text-red-600 font-medium">
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
