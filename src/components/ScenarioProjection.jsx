function ScenarioProjection({ scenario, data }) {
  const total = data.reduce((sum, tx) => {
    return tx.type === "expense" ? sum - tx.amount : sum + tx.amount;
  }, 0);

  return (
    <div
      className="
        mt-6 pt-4
        rounded-2xl
        bg-slate-950/60
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.9)]
        px-4 py-4
        text-slate-200
      "
    >
      <h3 className="text-lg font-semibold text-slate-100 mb-1">
        Proyección del mes: {scenario.name}
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Resumen de ingresos y gastos proyectados para el período actual.
      </p>

      <p className="text-sm mb-3">
        Total proyectado:{" "}
        <span
          className={
            total < 0
              ? "text-rose-300 font-semibold"
              : "text-emerald-300 font-semibold"
          }
        >
          {total.toFixed(2)} DOP
        </span>
      </p>

      <ul className="space-y-1 text-xs sm:text-sm max-h-64 overflow-y-auto pr-1">
        {data.map((tx, i) => (
          <li
            key={i}
            className="
              flex justify-between gap-3
              border-b border-slate-800/80 pb-1 pt-1
            "
          >
            <span className="text-slate-300">
              <span className="text-slate-400">{tx.date}</span>{" "}
              — {tx.name}
              {tx.description && (
                <span className="text-slate-500"> ({tx.description})</span>
              )}
            </span>
            <span
              className={
                tx.type === "expense" ? "text-rose-300" : "text-emerald-300"
              }
            >
              {tx.type === "income" ? "+" : "-"}
              {tx.amount.toFixed(2)} DOP
            </span>
          </li>
        ))}
        {data.length === 0 && (
          <li className="text-slate-500 italic pt-1">
            No hay movimientos proyectados para este período.
          </li>
        )}
      </ul>
    </div>
  );
}

export default ScenarioProjection;
