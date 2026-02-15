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
      .get(`${api}/accounts/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setRaw(res?.data?.data || []))
      .catch((err) => console.error("Error cargando saldos por cuenta:", err))
      .finally(() => setLoading(false));
  }, [token, api]);

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

  // ✅ Tooltip tokenizado (usa tus vars)
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]));
    const available = Number(byKey.available_balance || 0);
    const reserved = Number(byKey.reserved_total || 0);

    const row = payload?.[0]?.payload;
    const pctReserved = Number(row?.reserved_pct || 0);

    return (
      <div
        style={{
          background: "color-mix(in srgb, var(--bg-3) 78%, transparent)",
          border: "1px solid var(--border-rgba)",
          color: "var(--text)",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
          padding: "10px 12px",
          minWidth: 220,
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--heading)" }}>
          {label}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "var(--success)", fontWeight: 700 }}>
            Disponible
          </span>
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
          <span style={{ color: "var(--warning)", fontWeight: 700 }}>
            En metas
          </span>
          <span style={{ fontWeight: 800 }}>{formatCurrency(reserved)}</span>
        </div>

        <div
          style={{
            marginTop: 6,
            color: "var(--heading-muted)",
            fontSize: 12,
          }}
        >
          Reservado:{" "}
          <span style={{ fontWeight: 800, color: "var(--warning)" }}>
            {pctReserved.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{
        background:
          "linear-gradient(135deg, var(--panel), color-mix(in srgb, var(--panel) 75%, transparent))",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
        color: "var(--text)",
      }}
    >
      {/* Header + KPIs */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3
            className="text-xl font-semibold"
            style={{ color: "var(--heading)" }}
          >
            Saldos por cuenta
          </h3>
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-base font-medium" style={{ color: "var(--text)" }}>
            Total en cuentas:{" "}
            <span className={`font-semibold ${totalColor}`}>
              {formatCurrency(kpis.totalCurrent)}
            </span>
            {loading ? (
              <span className="ml-2 text-sm" style={{ color: "var(--muted)" }}>
                Actualizando…
              </span>
            ) : null}
          </p>

          <p className="text-sm text-right" style={{ color: "var(--muted)" }}>
            <span style={{ color: "var(--text)" }}>Disponible:</span>{" "}
            <span style={{ color: "var(--success)", fontWeight: 700 }}>
              {formatCurrency(kpis.totalAvailable)}
            </span>
            <span className="mx-2" style={{ color: "var(--heading-muted)" }}>
              ·
            </span>
            <span style={{ color: "var(--text)" }}>Positivo:</span>{" "}
            <span style={{ color: "var(--success)", fontWeight: 700 }}>
              {formatCurrency(kpis.positive)}
            </span>
            <span className="mx-2" style={{ color: "var(--heading-muted)" }}>
              ·
            </span>
            <span style={{ color: "var(--text)" }}>Negativo:</span>{" "}
            <span style={{ color: "var(--danger)", fontWeight: 700 }}>
              {formatCurrency(kpis.negative)}
            </span>
            <span className="mx-2" style={{ color: "var(--heading-muted)" }}>
              ·
            </span>
            <span style={{ color: "var(--text)" }}>Metas:</span>{" "}
            <span style={{ color: "var(--warning)", fontWeight: 700 }}>
              {formatCurrency(kpis.totalReserved)}
            </span>
            {kpis.negativeCount > 0 ? (
              <>
                <span className="mx-2" style={{ color: "var(--heading-muted)" }}>
                  ·
                </span>
                <span style={{ color: "var(--text)" }}>
                  {kpis.negativeCount} en negativo
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* Estados */}
      {loading && data.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          Cargando cuentas…
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          No hay cuentas registradas aún.
        </p>
      ) : (
        <div className="w-full h-[340px]">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid
                stroke="var(--border-rgba)"
                strokeDasharray="4 4"
              />

              <XAxis
                type="number"
                stroke="var(--border-rgba)"
                tick={{ fill: "var(--text)", fontSize: 12 }}
                tickFormatter={formatCompact}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={160}
                stroke="var(--border-rgba)"
                tick={{ fill: "var(--text)", fontSize: 12 }}
              />

              <ReferenceLine x={0} stroke="var(--border-rgba)" strokeDasharray="6 6" />

              <Tooltip
                cursor={{ fill: "color-mix(in srgb, var(--text) 6%, transparent)" }}
                content={<CustomTooltip />}
                wrapperStyle={{ zIndex: 999999 }}
              />

              <Legend
                wrapperStyle={{ color: "var(--text)" }}
                formatter={(value) => (
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    {value}
                  </span>
                )}
              />

              {/* ✅ Disponible */}
              <Bar
                dataKey="available_balance"
                stackId="a"
                fill="var(--success)"
                name="Disponible"
                radius={[6, 0, 0, 6]}
              />

              {/* ✅ En metas */}
              <Bar
                dataKey="reserved_total"
                stackId="a"
                fill="var(--warning)"
                name="En metas"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            Tip: “En metas” es dinero reservado; “Disponible” es lo que puedes
            usar sin romper metas.
          </p>
        </div>
      )}
    </div>
  );
}

export default AccountBalancesChart;
