// src/components/ItemPurchaseHistoryReport.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../Modal";
import FFSelect from "../FFSelect";

function ItemPurchaseHistoryReport({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");

  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState(null);

  const [open, setOpen] = useState(false);

  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const cardBg =
      "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))";

    const headerBg = "color-mix(in srgb, var(--panel-2) 75%, var(--bg-3))";
    const surface = "color-mix(in srgb, var(--panel) 65%, transparent)";
    const surface2 = "color-mix(in srgb, var(--panel-2) 65%, transparent)";

    return {
      border,
      card: {
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${border}`,
        background: cardBg,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      },
      tableWrap: {
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-md)",
        background: surface,
      },
      theadBg: headerBg,
      text: "var(--text)",
      muted: "var(--muted)",
      pillBg: surface2,
      btn: {
        background: "color-mix(in srgb, var(--primary) 14%, transparent)",
        border: `1px solid color-mix(in srgb, var(--primary) 35%, ${border})`,
        color: "var(--text)",
        borderRadius: "var(--radius-md)",
      },
    };
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  // ✅ Cargar items (solo id + name) y ordenar por nombre
  useEffect(() => {
    if (!token) return;

    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const res = await axios.get(`${api}/items`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 1000 },
        });

        const list = res.data?.data || [];

        const normalized = list
          .map((x) => ({
            id: x.id,
            name: x.name || "Sin nombre",
          }))
          .filter((x) => x.id);

        // ✅ Orden A-Z (aunque backend lo mande ordenado)
        normalized.sort((a, b) => a.name.localeCompare(b.name));

        setItems(normalized);

        // default: primer item
        if (!itemId && normalized.length) setItemId(normalized[0].id);
      } catch (err) {
        console.error("Error cargando items:", err);
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, api]);

  const selectedName = useMemo(() => {
    const it = items.find((x) => String(x.id) === String(itemId));
    return it?.name || "";
  }, [items, itemId]);

  const openHistory = async () => {
    if (!itemId) return;
    setLoadingHistory(true);

    try {
      const res = await axios.get(
        `${api}/analytics/item-purchase-history/${itemId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 200 },
        }
      );

      const list = res.data?.data || [];
      // ✅ Orden garantizado en frontend (por si el backend no lo respeta)
      list.sort((a, b) => {
        if (a.date === b.date) {
          return String(b.transaction_id || "").localeCompare(
            String(a.transaction_id || "")
          );
        }
        return String(b.date || "").localeCompare(String(a.date || ""));
      });

      setHistory(list);
      setMeta(res.data?.meta || null);
      setOpen(true);
    } catch (err) {
      console.error("Error item-purchase-history:", err);
      setHistory([]);
      setMeta(null);
      setOpen(true);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3
            className="text-lg md:text-xl font-semibold"
            style={{ color: ui.text }}
          >
            Histórico de compra por artículo
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Selecciona un artículo y revisa cuándo lo compraste, cuánto pagaste y
            la descripción de la transacción.
          </p>
        </div>
      </div>

      {/* Selector + botón */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[320px]">
          <span style={{ color: ui.muted }} className="text-sm">
            Artículo
          </span>

          {/* ✅ FFSelect SOLO NOMBRE */}
          <FFSelect
            value={itemId}
            onChange={(v) => setItemId(v)}
            options={items}
            placeholder={loadingItems ? "Cargando artículos..." : "Buscar artículo..."}
            disabled={loadingItems || items.length === 0}
            searchable
            clearable
            maxVisible={80}
            getOptionValue={(o) => o.id}
            getOptionLabel={(o) => o.name}
          />

          {items.length === 0 && !loadingItems ? (
            <span className="text-xs" style={{ color: ui.muted }}>
              No hay artículos registrados.
            </span>
          ) : null}
        </div>

        <button
          className="px-3 py-2 text-sm"
          style={ui.btn}
          onClick={openHistory}
          disabled={!itemId || loadingHistory}
          title={!itemId ? "Selecciona un artículo" : "Ver histórico"}
        >
          {loadingHistory ? "Cargando..." : "Ver histórico"}
        </button>
      </div>

      {/* Modal de histórico */}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={
          meta?.item_name
            ? `Histórico · ${meta.item_name}`
            : selectedName
            ? `Histórico · ${selectedName}`
            : "Histórico de compras"
        }
        size="xl"
      >
        {!meta && history.length === 0 ? (
          <p className="text-sm" style={{ color: ui.muted }}>
            No se encontraron compras para este artículo (o hubo un error
            consultando).
          </p>
        ) : (
          <div className="space-y-3">
            {meta ? (
              <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
                <div
                  className="rounded-xl px-3 py-2"
                  style={{
                    background: ui.pillBg,
                    border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
                    color: ui.muted,
                  }}
                >
                  <span>Total gastado:</span>{" "}
                  <strong style={{ color: "var(--primary)" }}>
                    {formatCurrency(meta.total_spent)}
                  </strong>
                </div>

                <div
                  className="rounded-xl px-3 py-2"
                  style={{
                    background: ui.pillBg,
                    border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
                    color: ui.muted,
                  }}
                >
                  <span>Precio promedio:</span>{" "}
                  <strong style={{ color: ui.text }}>
                    {formatCurrency(meta.avg_unit_price)}
                  </strong>
                </div>

                <div
                  className="rounded-xl px-3 py-2"
                  style={{
                    background: ui.pillBg,
                    border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
                    color: ui.muted,
                  }}
                >
                  <span>Rango:</span>{" "}
                  <strong style={{ color: ui.text }}>
                    {formatCurrency(meta.min_unit_price)} –{" "}
                    {formatCurrency(meta.max_unit_price)}
                  </strong>
                </div>

                <div
                  className="rounded-xl px-3 py-2"
                  style={{
                    background: ui.pillBg,
                    border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
                    color: ui.muted,
                  }}
                >
                  <span>Registros:</span>{" "}
                  <strong style={{ color: ui.text }}>{meta.count}</strong>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto" style={ui.tableWrap}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ background: ui.theadBg, color: ui.muted }}>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Descripción
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Precio unit.
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={`${h.transaction_id}_${h.date}_${h.total_paid}`}
                      style={{
                        borderBottom: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                      }}
                    >
                      <td className="px-3 py-2" style={{ color: ui.text }}>
                        {h.date}
                      </td>
                      <td className="px-3 py-2" style={{ color: ui.text }}>
                        {h.description}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        style={{ color: ui.text }}
                      >
                        {Number(h.quantity || 0).toFixed(2)}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        style={{ color: ui.text }}
                      >
                        {formatCurrency(h.unit_price)}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        style={{ color: ui.text }}
                      >
                        {formatCurrency(h.total_paid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs" style={{ color: ui.muted }}>
              Mostrando hasta 200 registros. 
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ItemPurchaseHistoryReport;