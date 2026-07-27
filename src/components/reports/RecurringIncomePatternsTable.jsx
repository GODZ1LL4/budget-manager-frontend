import RecurringExpensePatternsTable from "./RecurringExpensePatternsTable";

function RecurringIncomePatternsTable({ token }) {
  return <RecurringExpensePatternsTable token={token} transactionType="income" />;
}

export default RecurringIncomePatternsTable;
