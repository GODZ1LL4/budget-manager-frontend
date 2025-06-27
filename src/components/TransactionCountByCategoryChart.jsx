import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function TransactionCountByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/transaction-counts-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Cantidad de transacciones por categoría
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay transacciones registradas.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="category" type="category" />
            <Tooltip formatter={(value) => `${value} transacciones`} />
            <Legend />
            <Bar dataKey="count" fill="#6366f1" name="Cantidad" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TransactionCountByCategoryChart;
