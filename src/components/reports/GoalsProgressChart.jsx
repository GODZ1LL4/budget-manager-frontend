// src/components/reports/GoalsProgressChart.jsx
import { useEffect, useState } from "react";
import axios from "axios";

function formatCurrencyDOP(value) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;

  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(safe);
}

function GoalsProgressChart({ token }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    axios
      .get(`${api}/analytics/goals-progress`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const arr = Array.isArray(res.data?.data) ? res.data.data : [];
        setGoals(arr);
      })
      .catch((err) => {
        console.error("Error al cargar progreso de metas:", err);
        setError(
          err.response?.data?.error || "Error al cargar progreso de metas"
        );
      })
      .finally(() => setLoading(false));
  }, [token, api]);

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
        <h3 className="text-lg font-semibold text-slate-100">
          Progreso de metas de ahorro
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Visualiza cuánto has avanzado en cada una de tus metas activas.
        </p>
      </div>

      {/* Estados */}
      {loading && (
        <p className="text-sm text-slate-400 italic">
          Cargando progreso de metas…
        </p>
      )}

      {!loading && error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}

      {!loading && !error && goals.length === 0 && (
        <p className="text-sm text-slate-500 italic">No hay metas definidas.</p>
      )}

      {/* Lista */}
      {!loading && !error && goals.length > 0 && (
        <div className="space-y-5">
          {goals.map((g) => {
            const name = g?.name || "Meta";

            const current = Number(g?.current);
            const safeCurrent = Number.isFinite(current) ? current : 0;

            const target = Number(g?.target);
            const safeTarget = Number.isFinite(target) ? target : 0;

            const progress = Number(g?.progress);
            const safeProgressRaw = Number.isFinite(progress) ? progress : 0;

            const safeProgress = Math.min(Math.max(safeProgressRaw, 0), 100);
            const completed = safeProgressRaw >= 100;

            return (
              <div key={g?.id || name} className="space-y-1.5">
                {/* Título y porcentaje */}
                <div className="flex justify-between text-sm gap-3">
                  <span className="font-medium text-slate-200 truncate">
                    {name}
                  </span>

                  <span
                    className={`font-semibold whitespace-nowrap ${
                      completed ? "text-emerald-400" : "text-slate-300"
                    }`}
                    title={
                      safeTarget > 0
                        ? `${safeProgressRaw.toFixed(1)}%`
                        : "Meta sin objetivo (target 0)"
                    }
                  >
                    {safeProgressRaw.toFixed(1)}%
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 transition-all duration-500 rounded-full ${
                      completed
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                        : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                    }`}
                    style={{ width: `${safeProgress}%` }}
                  />
                </div>

                {/* Cantidad acumulada */}
                <p className="text-xs text-slate-400">
                  {formatCurrencyDOP(safeCurrent)} / {formatCurrencyDOP(safeTarget)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GoalsProgressChart;
