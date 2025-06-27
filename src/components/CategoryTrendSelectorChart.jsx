import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function CategoryTrendSelectorChart({ token }) {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/category-trend`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(res.data.data);

        // Extraer nombres de categorías de forma dinámica
        const categorySet = new Set();
        res.data.data.forEach((entry) => {
          Object.keys(entry).forEach((key) => {
            if (key !== "month") categorySet.add(key);
          });
        });

        const categoryList = Array.from(categorySet);
        setCategories(categoryList);
        setSelectedCategories(categoryList); // Seleccionar todas por defecto
      });
  }, [token]);

  const handleCategoryChange = (e) => {
    const { value, checked } = e.target;
    setSelectedCategories((prev) =>
      checked ? [...prev, value] : prev.filter((cat) => cat !== value)
    );
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Evolución de categorías seleccionadas
      </h3>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <label key={cat} className="flex items-center space-x-2">
            <input
              type="checkbox"
              value={cat}
              checked={selectedCategories.includes(cat)}
              onChange={handleCategoryChange}
              className="form-checkbox"
            />
            <span className="text-sm">{cat}</span>
          </label>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No hay datos disponibles.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `RD$ ${value.toFixed(2)}`} />
            <Legend />
            {selectedCategories.map((cat, index) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={`hsl(${(index * 60) % 360}, 70%, 50%)`}
                name={cat}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default CategoryTrendSelectorChart;
