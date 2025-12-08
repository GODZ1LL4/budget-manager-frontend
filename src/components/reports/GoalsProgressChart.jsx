import { useEffect, useState } from "react";
import axios from "axios";

function GoalsProgressChart({ token }) {
  const [goals, setGoals] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/goals-progress`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setGoals(res.data.data))
      .catch(() => alert("Error al cargar progreso de metas"));
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
        <h3 className="text-lg font-semibold text-slate-100">
          Progreso de metas de ahorro
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Visualiza cuánto has avanzado en cada una de tus metas activas.
        </p>
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay metas definidas.
        </p>
      ) : (
        <div className="space-y-5">
          {goals.map((g, idx) => {
            const safeProgress = Math.min(g.progress, 100);
            const completed = g.progress >= 100;

            return (
              <div key={idx} className="space-y-1.5">
                {/* Título y porcentaje */}
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-200 truncate">
                    {g.name}
                  </span>
                  <span
                    className={`font-semibold ${
                      completed ? "text-emerald-400" : "text-slate-300"
                    }`}
                  >
                    {g.progress.toFixed(1)}%
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
                  RD$ {g.current.toFixed(2)} / {g.target.toFixed(2)}
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
