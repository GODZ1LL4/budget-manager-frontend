import { useEffect, useState } from "react";
import axios from "axios";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";

function TransactionTypePieChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/transactions-by-type`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const d = res.data.data;
        setData([
          { name: "Ingresos", value: d.income },
          { name: "Gastos", value: d.expense },
        ]);
      });
  }, [token]);

  const COLORS = ["#10b981", "#ef4444"];

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Distribución por tipo de transacción
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          Sin transacciones registradas aún.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius="80%"
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(1)}%)`
              }
            >
              {data.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value} transacciones`} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TransactionTypePieChart;
