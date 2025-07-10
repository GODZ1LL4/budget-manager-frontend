import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function TopItemsByQuantityChart({ token }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [inputYear, setInputYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  const fetchTopItems = async () => {
    if (String(year).length !== 4 || isNaN(year)) {
      console.warn("Año inválido:", year);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${api}/analytics/top-items?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data.data);
    } catch (err) {
      console.error("Error al cargar top items por cantidad", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopItems();
  }, [year]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputYear.length === 4 && !isNaN(Number(inputYear))) {
      setYear(Number(inputYear));
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">
        Artículos más consumidos por cantidad
      </h3>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-4">
        <label htmlFor="year" className="text-sm">
          Año:
        </label>
        <input
          type="number"
          id="year"
          min="2000"
          max="2100"
          className="border border-gray-300 rounded px-2 py-1 w-24"
          value={inputYear}
          onChange={(e) => setInputYear(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
        >
          Buscar
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="item" />
            <YAxis />
            <Tooltip formatter={(val) => `${val} unidades`} />
            <Bar dataKey="quantity" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TopItemsByQuantityChart;
