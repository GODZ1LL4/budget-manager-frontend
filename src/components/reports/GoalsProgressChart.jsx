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
        setError(err.response?.data?.error || "Error al cargar progreso de metas");
      })
      .finally(() => setLoading(false));
  }, [token, api]);

  return (
    <div
      className="rounded-2xl p-6 space-y-4 border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom right, var(--bg-1), color-mix(in srgb, var(--panel) 45%, transparent), var(--bg-1))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
      }}
    >
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">
          Progreso de metas de ahorro
        </h3>
        <p className="text-sm mt-1 text-[color-mix(in srgb,var(--text)_70%,transparent)]">
          Visualiza cuánto has avanzado en cada una de tus metas activas.
        </p>
      </div>

      {/* Estados */}
      {loading && (
        <p className="text-sm italic text-[color-mix(in srgb,var(--text)_70%,transparent)]">
          Cargando progreso de metas…
        </p>
      )}

      {!loading && error && (
        <div
          className="text-sm rounded-xl p-3 border"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            color: "color-mix(in srgb, var(--danger) 85%, var(--text))",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && goals.length === 0 && (
        <p className="text-sm italic text-[color-mix(in srgb,var(--text)_60%,transparent)]">
          No hay metas definidas.
        </p>
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

            const progressBg = completed
              ? "linear-gradient(to right, color-mix(in srgb, var(--success) 85%, white), var(--success))"
              : "linear-gradient(to right, color-mix(in srgb, var(--success) 55%, transparent), var(--success))";

            return (
              <div key={g?.id || name} className="space-y-1.5">
                {/* Título y porcentaje */}
                <div className="flex justify-between text-sm gap-3">
                  <span className="font-medium truncate text-[color-mix(in srgb,var(--text)_88%,transparent)]">
                    {name}
                  </span>

                  <span
                    className="font-semibold whitespace-nowrap"
                    style={{
                      color: completed
                        ? "color-mix(in srgb, var(--success) 90%, var(--text))"
                        : "color-mix(in srgb, var(--text) 70%, transparent)",
                    }}
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
                <div
                  className="w-full rounded-full h-4 overflow-hidden border"
                  style={{
                    borderColor: "color-mix(in srgb, var(--border-rgba) 70%, transparent)",
                    background: "color-mix(in srgb, var(--panel) 65%, transparent)",
                  }}
                >
                  <div
                    className="h-4 transition-all duration-500 rounded-full"
                    style={{
                      width: `${safeProgress}%`,
                      background: progressBg,
                      boxShadow: completed
                        ? "0 12px 35px color-mix(in srgb, var(--success) 22%, transparent)"
                        : "0 10px 28px color-mix(in srgb, var(--success) 14%, transparent)",
                    }}
                  />
                </div>

                {/* Cantidad acumulada */}
                <p className="text-xs text-[color-mix(in srgb,var(--text)_65%,transparent)]">
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
