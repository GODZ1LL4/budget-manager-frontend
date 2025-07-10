import { useEffect, useState } from "react";
import axios from "axios";

function GoalsProgressChart({ token }) {
  const [goals, setGoals] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/goals-progress`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setGoals(res.data.data))
      .catch(() => alert("Error al cargar progreso de metas"));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-md font-semibold mb-4 text-gray-700">
        Progreso de metas de ahorro
      </h3>
      {goals.length === 0 ? (
        <p className="text-sm text-gray-500">No hay metas definidas.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g, idx) => (
            <div key={idx}>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {g.name} — {g.progress.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded h-4">
                <div
                  className="bg-green-500 h-4 rounded"
                  style={{ width: `${g.progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                RD$ {g.current.toFixed(2)} / {g.target.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GoalsProgressChart;
