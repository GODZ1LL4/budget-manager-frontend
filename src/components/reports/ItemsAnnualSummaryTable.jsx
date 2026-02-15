import { useEffect, useMemo, useState } from "react";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((row) =>
      String(row.item || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const moneyRD = (v) => {
    const num = Number(v ?? 0);
    return `RD$ ${num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // --- Clases tokenizadas (solo tokens core) ---
  const cardClass =
    "rounded-2xl p-6 space-y-5 border border-[var(--border-rgba)] " +
    "bg-[linear-gradient(135deg,var(--bg-1),color-mix(in srgb,var(--panel)_45%,transparent),var(--bg-1))] " +
    "shadow-[0_16px_40px_rgba(0,0,0,0.55)]";

  const titleClass = "font-semibold text-lg text-[var(--text)] mb-1";
  const descClass = "text-sm text-[var(--muted)]";

  // ✅ usa ff-input (si ya existe) y solo ajusta extras
  const inputClass = "ff-input text-sm px-3 py-2 rounded-lg";
  const yearInputClass = `${inputClass} w-28`;

  const searchInputClass =
    `${inputClass} flex-1 min-w-[220px] ` +
    "placeholder:text-[color-mix(in srgb,var(--muted)_80%,transparent)]";

  const tableWrapClass =
    "overflow-x-auto max-h-96 rounded-xl " +
    "border border-[var(--border-rgba)] " +
    "bg-[color-mix(in srgb,var(--panel)_62%,transparent)]";

  const tableClass = "min-w-full text-sm border-separate border-spacing-0";

  // ✅ header sticky sólido: bg en cada TH (no en thead)
  const thBase =
    "sticky top-0 z-20 text-[10px] sm:text-xs font-semibold uppercase tracking-wide " +
    "text-[color-mix(in srgb,var(--text)_72%,transparent)] " +
    "border-b border-[var(--border-rgba)] " +
    "shadow-[0_10px_18px_rgba(0,0,0,0.25)]";

  const thLeft = `${thBase} text-left px-4 py-2`;
  const thRight = `${thBase} text-right px-4 py-2`;

  const rowBase =
    "border-t border-[color-mix(in srgb,var(--border-rgba)_70%,transparent)] " +
    "hover:bg-[color-mix(in srgb,var(--primary)_10%,transparent)] transition-colors";

  const tdItem =
    "px-4 py-2 text-[color-mix(in srgb,var(--text)_92%,transparent)]";
  const tdNum =
    "px-4 py-2 text-right tabular-nums text-[color-mix(in srgb,var(--text)_82%,transparent)]";

  // ✅ Gasto total resaltado (tint suave, sin glow)
  const tdMoney =
    "px-4 py-2 text-right tabular-nums font-semibold " +
    "text-[color-mix(in srgb,var(--danger)_70%,var(--text))] " +
    "bg-[linear-gradient(90deg,color-mix(in srgb,var(--danger)_10%,transparent),transparent)]";

  const emptyClass =
    "text-center py-6 px-3 italic " +
    "text-[color-mix(in srgb,var(--muted)_80%,transparent)]";

  const noteClass =
    "text-xs leading-relaxed text-[color-mix(in srgb,var(--muted)_80%,transparent)]";
  const noteStrong = "text-[color-mix(in srgb,var(--text)_90%,transparent)]";

  return (
    <div className={cardClass}>
      {/* TÍTULO */}
      <div>
        <h3 className={titleClass}>Resumen anual de artículos</h3>
        <p className={descClass}>
          Cantidad total, gasto total y precio promedio por artículo en el año seleccionado.
        </p>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Año */}
        <div className="flex flex-col">
          <label className="text-[11px] uppercase tracking-[0.18em] text-[color-mix(in srgb,var(--text)_65%,transparent)]">
            Año
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value) || new Date().getFullYear())
            }
            className={yearInputClass}
            min="2000"
          />
        </div>

        {/* Búsqueda */}
        <div className="flex-1 min-w-[220px]">
          <label className="text-[11px] uppercase tracking-[0.18em] text-[color-mix(in srgb,var(--text)_65%,transparent)]">
            Buscar
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar artículo..."
            className={searchInputClass}
          />
        </div>
      </div>

      {/* TABLA */}
      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead className="relative z-10">
            <tr>
              <th className={thLeft} style={{ background: "var(--panel)" }}>
                Artículo
              </th>
              <th className={thRight} style={{ background: "var(--panel)" }}>
                Cantidad total
              </th>
              <th
                className={thRight}
                style={{
                  background: "color-mix(in srgb,var(--danger)_10%,var(--panel))",
                }}
              >
                Gasto total
              </th>
              <th className={thRight} style={{ background: "var(--panel)" }}>
                Precio promedio
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className={emptyClass}>
                  Sin datos para el año seleccionado.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr key={row.item_id || `${row.item}-${idx}`} className={rowBase}>
                  <td className={tdItem}>{row.item}</td>

                  <td className={tdNum}>
                    {Number(row.total_quantity || 0).toFixed(2)}
                  </td>

                  <td className={tdMoney}>{moneyRD(row.total_spent)}</td>

                  <td className={tdNum}>{moneyRD(row.avg_price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* NOTA INFORMATIVA */}
      <p className={noteClass}>
        El precio promedio se calcula como{" "}
        <strong className={noteStrong}>Gasto total ÷ Cantidad total</strong>. Los
        valores incluyen ITBIS si el artículo lo aplica.
      </p>
    </div>
  );
}

export default ItemsAnnualSummaryTable;
