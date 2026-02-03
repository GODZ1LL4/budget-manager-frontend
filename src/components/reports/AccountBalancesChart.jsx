// src/components/reports/AccountBalancesChart.jsx
import { useEffect, useMemo, useState } from "react";
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
  ReferenceLine,
} from "recharts";

const formatCurrency = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

const formatCompact = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-DO", { notation: "compact" }).format(n);
};

function AccountBalancesChart({ token }) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      // ✅ endpoint correcto con available_balance y reserved_total
      .get(`${api}/accounts/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setRaw(res?.data?.data || []))
      .catch((err) => console.error("Error cargando saldos por cuenta:", err))
      .finally(() => setLoading(false));
  }, [token, api]);

  // ✅ normalización para barras apiladas (disponible + en metas)
  const data = useMemo(() => {
    return (raw || []).map((r) => {
      const current = Number(r.current_balance) || 0;
      const reserved = Math.max(0, Number(r.reserved_total) || 0);
      const available = Number.isFinite(Number(r.available_balance))
        ? Math.max(0, Number(r.available_balance))
        : Math.max(0, current - reserved);

      const totalPositive = Math.max(0, current);
      const reservedPct =
        totalPositive > 0 ? (reserved / totalPositive) * 100 : 0;

      return {
        id: r.id,
        name: r.name || "Cuenta",
        current_balance: current,
        reserved_total: reserved,
        available_balance: available,
        reserved_pct: reservedPct,
      };
    });
  }, [raw]);

  const kpis = useMemo(() => {
    const totalCurrent = (data || []).reduce(
      (acc, r) => acc + (Number(r.current_balance) || 0),
      0
    );
    const totalReserved = (data || []).reduce(
      (acc, r) => acc + (Number(r.reserved_total) || 0),
      0
    );
    const totalAvailable = (data || []).reduce(
      (acc, r) => acc + (Number(r.available_balance) || 0),
      0
    );

    const positive = (data || []).reduce(
      (acc, r) =>
        acc +
        ((Number(r.current_balance) || 0) > 0
          ? Number(r.current_balance) || 0
          : 0),
      0
    );
    const negative = (data || []).reduce(
      (acc, r) =>
        acc +
        ((Number(r.current_balance) || 0) < 0
          ? Number(r.current_balance) || 0
          : 0),
      0
    );
    const negativeCount = (data || []).filter(
      (r) => (Number(r.current_balance) || 0) < 0
    ).length;

    const reservedPctGlobal =
      positive > 0 ? (totalReserved / positive) * 100 : 0;

    return {
      totalCurrent,
      totalReserved,
      totalAvailable,
      positive,
      negative,
      negativeCount,
      reservedPctGlobal,
    };
  }, [data]);

  const totalColor =
    kpis.totalCurrent >= 0 ? "text-emerald-300" : "text-rose-300";

  // ✅ Tooltip custom para mostrar disponible + metas + porcentaje
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    // payload trae las barras apiladas; buscamos valores por dataKey
    const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]));
    const available = Number(byKey.available_balance || 0);
    const reserved = Number(byKey.reserved_total || 0);

    const row = payload?.[0]?.payload;
    const pctReserved = Number(row?.reserved_pct || 0);

    return (
      <div
        style={{
          backgroundColor: "#020617",
          border: "1px solid rgba(214,164,58,0.55)",
          color: "#e5e7eb",
          borderRadius: "0.75rem",
          boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
          padding: "10px 12px",
          minWidth: 220,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>

        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <span style={{ color: "#a7f3d0", fontWeight: 700 }}>Disponible</span>
          <span style={{ fontWeight: 800 }}>{formatCurrency(available)}</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 4,
          }}
        >
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>En metas</span>
          <span style={{ fontWeight: 800 }}>{formatCurrency(reserved)}</span>
        </div>

        <div
          style={{
            marginTop: 6,
            color: "rgba(226,232,240,0.75)",
            fontSize: 12,
          }}
        >
          Reservado:{" "}
          <span style={{ fontWeight: 800, color: "#fbbf24" }}>
            {pctReserved.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
    >
      {/* Header + KPIs */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Saldos por cuenta
          </h3>
          
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Total en cuentas: solo el monto con color */}
          <p className="text-base font-medium text-slate-200">
            Total en cuentas:{" "}
            <span className={`font-semibold ${totalColor}`}>
              {formatCurrency(kpis.totalCurrent)}
            </span>
            {loading ? (
              <span className="text-slate-300 ml-2 text-sm">Actualizando…</span>
            ) : null}
          </p>

          {/* Línea compacta: solo montos con color */}
          <p className="text-sm text-slate-300 text-right">
            <span className="text-slate-200 font-medium">Disponible:</span>{" "}
            <span className="text-emerald-300 font-semibold">
              {formatCurrency(kpis.totalAvailable)}
            </span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="text-slate-200 font-medium">Positivo:</span>{" "}
            <span className="text-emerald-300 font-semibold">
              {formatCurrency(kpis.positive)}
            </span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="text-slate-200 font-medium">Negativo:</span>{" "}
            <span className="text-rose-300 font-semibold">
              {formatCurrency(kpis.negative)}
            </span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="text-slate-200 font-medium">Metas:</span>{" "}
            <span className="text-amber-300 font-semibold">
              {formatCurrency(kpis.totalReserved)}
            </span>
            {kpis.negativeCount > 0 ? (
              <>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-200 font-medium">
                  {kpis.negativeCount} en negativo
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* Estados */}
      {loading && data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Cargando cuentas…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay cuentas registradas aún.
        </p>
      ) : (
        <div className="w-full h-[340px]">
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />

              <XAxis
                type="number"
                stroke="#94a3b8"
                tick={{ fill: "#e2e8f0", fontSize: 12 }}
                tickFormatter={formatCompact}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={160}
                stroke="#94a3b8"
                tick={{ fill: "#e2e8f0", fontSize: 12 }}
              />

              <ReferenceLine x={0} stroke="#64748b" strokeDasharray="6 6" />

              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={<CustomTooltip />}
                // Recharts normalmente no se recorta, pero esto ayuda cerca del borde
                wrapperStyle={{ zIndex: 999999 }}
              />

              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-sm">{value}</span>
                )}
              />

              {/* ✅ Apilado: Disponible (verde) */}
              <Bar
                dataKey="available_balance"
                stackId="a"
                fill="#10b981"
                name="Disponible"
                radius={[6, 0, 0, 6]}
              />

              {/* ✅ Apilado: En metas (dorado/naranja) pegado al verde */}
              <Bar
                dataKey="reserved_total"
                stackId="a"
                fill="#f59e0b"
                name="En metas"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-sm text-slate-300 mt-2">
            Tip: “En metas” es dinero reservado; “Disponible” es lo que puedes
            usar sin romper metas.
          </p>
        </div>
      )}
    </div>
  );
}

export default AccountBalancesChart;
