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
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-5
      "
    >
      {/* TÍTULO */}
      <div>
        <h3 className="font-semibold text-lg text-slate-100 mb-1">
          Resumen anual de artículos
        </h3>
        <p className="text-sm text-slate-400">
          Cantidad total, gasto total y precio promedio por artículo en el año seleccionado.
        </p>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Año */}
        <input
          type="number"
          value={year}
          onChange={(e) =>
            setYear(Number(e.target.value) || new Date().getFullYear())
          }
          className="
            border border-slate-700 rounded-lg px-3 py-1.5 w-24
            bg-slate-900 text-slate-100 text-sm
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70
          "
          min="2000"
        />

        {/* Búsqueda */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar artículo..."
          className="
            border border-slate-700 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]
            bg-slate-900 text-slate-100 text-sm
            placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70
          "
        />
      </div>

      {/* TABLA */}
      <div
        className="
          overflow-x-auto max-h-96 rounded-xl
          border border-slate-800 bg-slate-950/40
        "
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-slate-300 border-b border-slate-700">
              <th className="text-left px-4 py-2 font-medium">Artículo</th>
              <th className="text-right px-4 py-2 font-medium">Cantidad total</th>
              <th className="text-right px-4 py-2 font-medium">Gasto total</th>
              <th className="text-right px-4 py-2 font-medium">Precio promedio</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-slate-500 py-4 px-3 italic"
                >
                  Sin datos para el año seleccionado.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.item_id}
                  className="
                    border-b border-slate-800 last:border-0
                    hover:bg-slate-900/50 transition-colors
                  "
                >
                  <td className="px-4 py-2 text-slate-200">{row.item}</td>

                  <td className="px-4 py-2 text-right text-slate-300">
                    {row.total_quantity.toFixed(2)}
                  </td>

                  <td className="px-4 py-2 text-right text-rose-400 font-medium">
                    RD{" "}
                    {row.total_spent.toLocaleString("es-DO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-2 text-right text-slate-300">
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

      {/* NOTA INFORMATIVA */}
      <p className="text-xs text-slate-500 leading-relaxed">
        El precio promedio se calcula como{" "}
        <strong className="text-slate-300">Gasto total ÷ Cantidad total</strong>.
        Los valores incluyen ITBIS si el artículo lo aplica.
      </p>
    </div>
  );
}

export default ItemsAnnualSummaryTable;
