// src/components/reports/AntExpensesReport.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../Modal";
import FFSelect from "../FFSelect";

function AntExpensesReport({ token }) {
  const api = import.meta.env.VITE_API_URL;

  // defaults: últimos 30 días
  const today = new Date();
  const toDefault = today.toISOString().split("T")[0];
  const fromDefault = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 30
  )
    .toISOString()
    .split("T")[0];

  const [dateFrom, setDateFrom] = useState(fromDefault);
  const [dateTo, setDateTo] = useState(toDefault);
  const [maxAmount, setMaxAmount] = useState(200);
  const [minCount, setMinCount] = useState(3);
  const [groupBy, setGroupBy] = useState("description"); // description|category
  const [excludeAuto, setExcludeAuto] = useState(true);
  const [limit, setLimit] = useState(15);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  // modal de detalle (TODAS)
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRows, setDetailRows] = useState([]);
  const [detailMeta, setDetailMeta] = useState(null);
  const [detailError, setDetailError] = useState("");

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
      rowHover: "color-mix(in srgb, var(--panel-2) 55%, transparent)",
      text: "var(--text)",
      muted: "var(--muted)",
      input: {
        background: "var(--control-bg)",
        color: "var(--control-text)",
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-sm)",
        boxShadow: "none",
      },
      inputFocusRing: "var(--control-focus-shadow)",
      inputHoverBorder:
        "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))",
      pillBg: surface2,
      btn: {
        background: "color-mix(in srgb, var(--primary) 14%, transparent)",
        border: `1px solid color-mix(in srgb, var(--primary) 35%, ${border})`,
        color: "var(--text)",
        borderRadius: "var(--radius-md)",
      },
      danger: "var(--danger)",
    };
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${api}/analytics/ant-expenses`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          max_amount: maxAmount,
          min_count: minCount,
          group_by: groupBy,
          exclude_auto: excludeAuto ? 1 : 0,
          limit,
        },
      });
      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      console.error("Error ant-expenses:", err);
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchDetail = async (row) => {
    if (!token || !row?.key) return;

    setDetailLoading(true);
    setDetailRows([]);
    setDetailMeta(null);
    setDetailError("");

    try {
      // 👇 IMPORTANTE:
      // - Para category: key = category_id
      // - Para description: key = la "llave" del grupo (en tu endpoint /ant-expenses es normalizedDesc)
      //   Por eso el backend /ant-expenses-detail debe filtrar por normalizeDesc(description) === key
      const res = await axios.get(`${api}/analytics/ant-expenses-detail`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          group_by: groupBy,
          key: row.key,
          date_from: dateFrom,
          date_to: dateTo,
          max_amount: maxAmount,
          exclude_auto: excludeAuto ? 1 : 0,
          limit: 2000, // “todas” (cap de seguridad)
          offset: 0,
        },
      });

      setDetailRows(res.data?.data || []);
      setDetailMeta(res.data?.meta || null);
    } catch (err) {
      console.error("Error ant-expenses-detail:", err);
      setDetailError(
        err?.response?.data?.error || "No se pudo cargar el detalle."
      );
      setDetailRows([]);
      setDetailMeta(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = async (row) => {
    setSelected(row);
    setOpen(true);
    await fetchDetail(row);
  };

  const closeModal = () => {
    setOpen(false);
    setSelected(null);
    setDetailRows([]);
    setDetailMeta(null);
    setDetailError("");
    setDetailLoading(false);
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3
            className="text-lg md:text-xl font-semibold"
            style={{ color: ui.text }}
          >
            Gastos hormiga
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Detecta gastos pequeños y repetitivos que se acumulan con el tiempo.
          </p>
        </div>

        <button
          className="px-3 py-2 text-sm"
          style={ui.btn}
          onClick={fetchData}
          disabled={loading}
          title="Actualizar"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 text-sm items-end">
        <div className="flex flex-col gap-1">
          <span style={{ color: ui.muted }}>Desde</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={ui.input}
            className="px-2 h-10"
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = ui.inputFocusRing;
              e.currentTarget.style.borderColor = ui.inputHoverBorder;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = ui.border;
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span style={{ color: ui.muted }}>Hasta</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={ui.input}
            className="px-2 h-10"
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = ui.inputFocusRing;
              e.currentTarget.style.borderColor = ui.inputHoverBorder;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = ui.border;
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span style={{ color: ui.muted }}>Máximo por compra</span>
          <input
            type="number"
            value={maxAmount}
            min="1"
            onChange={(e) => setMaxAmount(Number(e.target.value))}
            style={ui.input}
            className="w-32 px-2 h-10"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span style={{ color: ui.muted }}>Mínimo veces</span>
          <input
            type="number"
            value={minCount}
            min="1"
            onChange={(e) => setMinCount(Number(e.target.value))}
            style={ui.input}
            className="w-28 px-2 h-10"
          />
        </div>

        {/* FFSelect alineado */}
        <div className="flex flex-col gap-1 w-[220px]">
          <span style={{ color: ui.muted }}>Agrupar por</span>
          <div className="h-10">
            <FFSelect
              value={groupBy}
              onChange={(v) => setGroupBy(v)}
              options={[
                { id: "description", name: "Descripción" },
                { id: "category", name: "Categoría" },
              ]}
              placeholder="Selecciona..."
              searchable={false}
              clearable={false}
              getOptionValue={(o) => o.id}
              getOptionLabel={(o) => o.name}
              className="h-10"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 select-none h-10 pb-[2px]">
          <input
            type="checkbox"
            checked={excludeAuto}
            onChange={(e) => setExcludeAuto(e.target.checked)}
          />
          <span style={{ color: ui.muted }}>Excluir [AUTO]</span>
        </label>

        <div className="flex flex-col gap-1">
          <span style={{ color: ui.muted }}>Top</span>
          <input
            type="number"
            value={limit}
            min="5"
            max="50"
            onChange={(e) => setLimit(Number(e.target.value))}
            style={ui.input}
            className="w-20 px-2 h-10"
          />
        </div>
      </div>

      {/* Meta */}
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
            <span>Rango:</span>{" "}
            <strong style={{ color: ui.text }}>{meta.date_from}</strong>{" "}
            <span>→</span>{" "}
            <strong style={{ color: ui.text }}>{meta.date_to}</strong>
          </div>

          <div
            className="rounded-xl px-3 py-2"
            style={{
              background: ui.pillBg,
              border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
              color: ui.muted,
            }}
          >
            <span>Umbral:</span>{" "}
            <strong style={{ color: "var(--primary)" }}>
              {formatCurrency(meta.max_amount)}
            </strong>{" "}
            <span>· min {meta.min_count} veces</span>
          </div>
        </div>
      ) : null}

      {/* Tabla */}
      {loading ? (
        <p className="text-sm" style={{ color: ui.muted }}>
          Cargando gastos hormiga...
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: ui.muted }}>
          No se detectaron gastos hormiga con esos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto" style={ui.tableWrap}>
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ background: ui.theadBg, color: ui.muted }}>
                <th className="px-3 py-2 text-left font-medium">
                  {groupBy === "category" ? "Categoría" : "Descripción"}
                </th>
                <th className="px-3 py-2 text-right font-medium">Veces</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Promedio</th>
                <th className="px-3 py-2 text-right font-medium">Última vez</th>
                <th className="px-3 py-2 text-right font-medium">Detalle</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                const baseBg =
                  idx % 2 === 0
                    ? "transparent"
                    : "color-mix(in srgb, var(--panel) 35%, transparent)";

                return (
                  <tr
                    key={r.key}
                    style={{
                      borderBottom: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                      background: baseBg,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = ui.rowHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = baseBg;
                    }}
                  >
                    <td className="px-3 py-2" style={{ color: ui.text }}>
                      {r.label}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{ color: ui.text }}
                    >
                      {r.count}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{ color: ui.text }}
                    >
                      {formatCurrency(r.total)}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{ color: ui.text }}
                    >
                      {formatCurrency(r.avg)}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{ color: ui.text }}
                    >
                      {r.last_date || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="px-2 py-1 text-xs"
                        style={ui.btn}
                        onClick={() => openDetail(r)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: TODAS las transacciones del grupo */}
      <Modal
        isOpen={open}
        onClose={closeModal}
        title={`Detalle · ${selected?.label || ""}`}
        size="xl"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <div style={{ color: ui.muted }}>
              Veces:{" "}
              <strong style={{ color: ui.text }}>
                {selected?.count ?? 0}
              </strong>
            </div>
            <div style={{ color: ui.muted }}>
              Total:{" "}
              <strong style={{ color: "var(--primary)" }}>
                {formatCurrency(selected?.total ?? 0)}
              </strong>
            </div>
            <div style={{ color: ui.muted }}>
              Promedio:{" "}
              <strong style={{ color: ui.text }}>
                {formatCurrency(selected?.avg ?? 0)}
              </strong>
            </div>
            <div style={{ color: ui.muted }}>
              Rango:{" "}
              <strong style={{ color: ui.text }}>
                {selected?.first_date || "—"} → {selected?.last_date || "—"}
              </strong>
            </div>
          </div>

          {/* Estado de carga/error */}
          {detailLoading ? (
            <p className="text-sm" style={{ color: ui.muted }}>
              Cargando transacciones del grupo...
            </p>
          ) : detailError ? (
            <p className="text-sm" style={{ color: ui.danger }}>
              {detailError}
            </p>
          ) : detailRows.length === 0 ? (
            <div className="space-y-1">
              <p className="text-sm" style={{ color: ui.muted }}>
                No hay transacciones para mostrar con estos filtros.
              </p>
              <p className="text-xs" style={{ color: ui.muted }}>
                Mostrando {detailMeta?.returned ?? 0} transacciones encontradas
                para este gasto hormiga.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div style={{ color: ui.muted }}>
                  Mostrando{" "}
                  <strong style={{ color: ui.text }}>
                    {detailRows.length}
                  </strong>{" "}
                  transacciones.
                  {detailMeta?.limit ? (
                    <>
                      {" "}
                      (Límite:{" "}
                      <strong style={{ color: ui.text }}>
                        {detailMeta.limit}
                      </strong>
                      )
                    </>
                  ) : null}
                </div>

                <button
                  className="px-3 py-2 text-xs"
                  style={ui.btn}
                  onClick={() => selected && fetchDetail(selected)}
                  disabled={detailLoading}
                  title="Refrescar detalle"
                >
                  Refrescar
                </button>
              </div>

              <div style={ui.tableWrap} className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ background: ui.theadBg, color: ui.muted }}>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Descripción
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Categoría
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((t) => (
                      <tr
                        key={t.id}
                        style={{
                          borderBottom: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                        }}
                      >
                        <td className="px-3 py-2" style={{ color: ui.text }}>
                          {t.date}
                        </td>
                        <td className="px-3 py-2" style={{ color: ui.text }}>
                          {t.description}
                        </td>
                        <td className="px-3 py-2" style={{ color: ui.text }}>
                          {t.category}
                        </td>
                        <td
                          className="px-3 py-2 text-right"
                          style={{ color: ui.text }}
                        >
                          {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default AntExpensesReport;