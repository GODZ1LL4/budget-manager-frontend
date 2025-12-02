import { useEffect, useState } from "react";
import axios from "axios";

function ItemsAnnualSummaryTable({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/items-annual-summary?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar resumen anual de ítems:", err);
      });
  }, [token, year, api]);

  const filtered = data.filter((row) =>
    row.item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">
        Resumen anual de artículos (cantidad, gasto y precio promedio)
      </h3>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="number"
          value={year}
          onChange={(e) =>
            setYear(Number(e.target.value) || new Date().getFullYear())
          }
          className="border border-gray-300 rounded p-1 w-24"
          min="2000"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por nombre de artículo..."
          className="border border-gray-300 rounded p-1 flex-1 min-w-[200px]"
        />
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="text-left px-3 py-2">Artículo</th>
              <th className="text-right px-3 py-2">Cantidad total</th>
              <th className="text-right px-3 py-2">Gasto total</th>
              <th className="text-right px-3 py-2">Precio promedio</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-gray-500 py-4 px-3"
                >
                  Sin datos para el año seleccionado.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.item_id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 text-gray-800">{row.item}</td>
                  <td className="px-3 py-2 text-right">
                    {row.total_quantity.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-600">
                    RD{" "}
                    {row.total_spent.toLocaleString("es-DO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-800">
                    RD{" "}
                    {row.avg_price.toLocaleString("es-DO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        El precio promedio se calcula como <strong>Gasto total ÷ Cantidad total</strong> 
         para cada artículo, usando los valores finales (incluyendo impuestos si aplican).
      </p>
    </div>
  );
}

export default ItemsAnnualSummaryTable;
