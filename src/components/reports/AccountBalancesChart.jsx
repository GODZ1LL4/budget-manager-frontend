import { useEffect, useState } from "react";
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
} from "recharts";

function AccountBalancesChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/account-balances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch((err) => console.error(err));
  }, [token]);

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
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Saldos por Cuenta
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Visualiza el saldo actual de todas tus cuentas registradas.
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay movimientos registrados.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <BarChart data={data}>
              {/* Grid tenue */}
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />

              {/* Eje X */}
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />

              {/* Eje Y */}
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />

              {/* Tooltip oscuro */}
              <Tooltip
                formatter={(val) => `RD$ ${val.toFixed(2)}`}
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

              {/* Leyenda */}
              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-sm">{value}</span>
                )}
              />

              {/* Barra principal */}
              <Bar dataKey="balance" fill="#10b981" name="Saldo actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default AccountBalancesChart;
