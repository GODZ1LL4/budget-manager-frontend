import ExpenseDistributionByCategoryChart from "./ExpenseDistributionByCategoryChart";

function IncomeDistributionByCategoryChart({
  incomeByCategory = {},
  categoryNameMap = {},
  token,
}) {
  return (
    <ExpenseDistributionByCategoryChart
      expensesByCategory={incomeByCategory}
      categoryNameMap={categoryNameMap}
      token={token}
      transactionType="income"
    />
  );
}

export default IncomeDistributionByCategoryChart;
