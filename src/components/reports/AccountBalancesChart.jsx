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
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

function AccountBalancesChart({ token }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/account-balances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => console.error("Error cargando saldos por cuenta:", err))
      .finally(() => setLoading(false));
  }, [token, api]);

  const kpis = useMemo(() => {
    const total = (data || []).reduce(
      (acc, r) => acc + (Number(r.balance) || 0),
      0
    );
    const positive = (data || []).reduce(
      (acc, r) => acc + ((Number(r.balance) || 0) > 0 ? Number(r.balance) || 0 : 0),
      0
    );
    const negative = (data || []).reduce(
      (acc, r) => acc + ((Number(r.balance) || 0) < 0 ? Number(r.balance) || 0 : 0),
      0
    );
    const negativeCount = (data || []).filter((r) => (Number(r.balance) || 0) < 0).length;

    return { total, positive, negative, negativeCount };
  }, [data]);

  const totalColor = kpis.total >= 0 ? "text-emerald-300" : "text-rose-300";

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
      {/* Header + KPI */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">Saldos por Cuenta</h3>
          <p className="text-sm text-slate-300 mt-1">
            Visualiza el saldo actual de todas tus cuentas registradas.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* KPI principal (más grande) */}
          <p className={`text-base font-medium ${totalColor}`}>
            Total en cuentas:{" "}
            <span className="font-semibold">{formatCurrency(kpis.total)}</span>
            {loading ? (
              <span className="text-slate-300 ml-2 text-sm">Actualizando…</span>
            ) : null}
          </p>

          {/* KPI secundario (labels menos opacos + fuente mayor) */}
          <p className="text-sm text-slate-300">
            <span className="text-slate-200 font-medium">Positivo:</span>{" "}
            <span className="text-emerald-300 font-semibold">
              {formatCurrency(kpis.positive)}
            </span>

            <span className="mx-2 text-slate-500">·</span>

            <span className="text-slate-200 font-medium">Negativo:</span>{" "}
            <span className="text-rose-300 font-semibold">
              {formatCurrency(kpis.negative)}
            </span>

            {kpis.negativeCount > 0 && (
              <>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-200 font-medium">
                  {kpis.negativeCount} en negativo
                </span>
              </>
            )}
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
        <div className="w-full h-[320px]">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />

              <XAxis
                type="number"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={(v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return "";
                  return new Intl.NumberFormat("es-DO", { notation: "compact" }).format(n);
                }}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={150}
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />

              <ReferenceLine x={0} stroke="#64748b" strokeDasharray="6 6" />

              <Tooltip
                formatter={(val) => formatCurrency(val)}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
              />

              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-sm">{value}</span>
                )}
              />

              <Bar
                dataKey="balance"
                fill="#10b981"
                name="Saldo actual"
                radius={[6, 6, 6, 6]}
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-sm text-slate-300 mt-2">
            Tip: si una cuenta cruza la línea 0, significa que está en negativo.
          </p>
        </div>
      )}
    </div>
  );
}

export default AccountBalancesChart;
