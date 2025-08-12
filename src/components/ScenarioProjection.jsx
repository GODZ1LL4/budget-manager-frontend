function ScenarioProjection({ scenario, data }) {
    const total = data.reduce((sum, tx) => {
      return tx.type === "expense" ? sum - tx.amount : sum + tx.amount;
    }, 0);
  
    return (
      <div className="mt-6 border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Proyección del mes: {scenario.name}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          Total proyectado:{" "}
          <span
            className={total < 0 ? "text-red-600" : "text-green-600"}
          >
            {total.toFixed(2)} DOP
          </span>
        </p>
  
        <ul className="space-y-1 text-sm">
          {data.map((tx, i) => (
            <li key={i} className="flex justify-between border-b pb-1">
              <span>
                {tx.date} — {tx.name} ({tx.description})
              </span>
              <span
                className={tx.type === "expense" ? "text-red-600" : "text-green-600"}
              >
                {tx.type === "income" ? "+" : "-"}
                {tx.amount.toFixed(2)} DOP
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  
  export default ScenarioProjection;
