import {
  addDaysToDateKey,
  lastDayOfMonthDateKey,
  startOfWeekDateKey,
  todayDateKey,
} from "../dates/localDate";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnly(value) {
  return String(value || "").slice(0, 10);
}

function dateKeyToUtcMs(dateKey) {
  const [year, month, day] = String(dateKey || "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function daysBetweenDateKeys(fromDateKey, toDateKey) {
  const from = dateKeyToUtcMs(fromDateKey);
  const to = dateKeyToUtcMs(toDateKey);

  if (from == null || to == null) {
    return null;
  }

  return Math.max(0, Math.floor((to - from) / 86400000));
}

function getToday() {
  return todayDateKey();
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function getCurrentYear() {
  return getToday().slice(0, 4);
}

function getStartOfWeekIso(todayIso) {
  return startOfWeekDateKey(todayIso);
}

function isTransfer(tx) {
  return String(tx?.type || "") === "transfer";
}

function getSignedAmount(tx) {
  const amount = toNumber(tx?.amount);
  if (tx?.type === "income") return amount;
  if (tx?.type === "expense") return -Math.abs(amount);
  return 0;
}

function getProgressPct(current, target) {
  const safeTarget = toNumber(target);
  if (safeTarget <= 0) return 0;
  return Math.max(0, Math.min((toNumber(current) / safeTarget) * 100, 100));
}

function getExpenseStreak(expenseDateSet, today) {
  let streak = 0;
  let cursor = today;

  while (expenseDateSet.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return streak;
}

function buildAchievementBadges({
  accountSnapshot,
  budgetAlerts,
  dailyPulse,
  goalsSummary,
  monthSummary,
}) {
  const badges = [];
  const topGoal = goalsSummary.items.find((goal) => goal.progressPct >= 80);
  const overBudgetItem = budgetAlerts.overBudget[0];
  const nearLimitItem = budgetAlerts.nearLimit[0];

  if (dailyPulse.todayExpense > 0) {
    badges.push({
      id: "expense-today",
      label: "Gasto al dia",
      detail: "Hoy ya registraste",
      tone: "primary",
      icon: "check",
    });
  }

  if (dailyPulse.expenseStreak >= 3) {
    badges.push({
      id: "expense-streak",
      label: `${dailyPulse.expenseStreak} dias`,
      detail: "racha de registro",
      tone: "warning",
      icon: "bolt",
    });
  }

  if (goalsSummary.completedGoals > 0) {
    badges.push({
      id: "goal-completed",
      label: "Meta cumplida",
      detail:
        goalsSummary.completedGoals === 1
          ? "1 objetivo cerrado"
          : `${goalsSummary.completedGoals} objetivos cerrados`,
      tone: "success",
      icon: "badge",
    });
  }

  if (topGoal) {
    badges.push({
      id: `goal-progress-${topGoal.id}`,
      label: "Cerca de meta",
      detail: `${topGoal.name} ${topGoal.progressPct.toFixed(0)}%`,
      tone: "success",
      icon: "flag",
    });
  }

  if (overBudgetItem) {
    badges.push({
      id: `budget-over-${overBudgetItem.id || overBudgetItem.category_id}`,
      label: "Presupuesto alerta",
      detail: overBudgetItem.category_name,
      tone: "danger",
      icon: "alert",
    });
  } else if (nearLimitItem) {
    badges.push({
      id: `budget-near-${nearLimitItem.id || nearLimitItem.category_id}`,
      label: "Cerca del limite",
      detail: `${nearLimitItem.category_name} ${nearLimitItem.spentPct.toFixed(
        0
      )}%`,
      tone: "warning",
      icon: "alert",
    });
  } else if (budgetAlerts.hasBudgets) {
    badges.push({
      id: "budget-ok",
      label: "Presupuestos OK",
      detail: "sin alertas este mes",
      tone: "success",
      icon: "shield",
    });
  }

  if (monthSummary.movements >= 10) {
    badges.push({
      id: "month-active",
      label: "Mes activo",
      detail: `${monthSummary.movements} movimientos`,
      tone: "primary",
      icon: "spark",
    });
  }

  if (accountSnapshot.reserved > 0) {
    badges.push({
      id: "reserved-money",
      label: "Ahorro activo",
      detailAmount: accountSnapshot.reserved,
      detailSuffix: "reservado",
      tone: "success",
      icon: "shield",
    });
  }

  return badges.slice(0, 6);
}

export function buildMobileDashboardData({
  accounts = [],
  balances = {},
  categories = [],
  transactions = [],
  budgets = [],
  goals = [],
}) {
  const today = getToday();
  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();
  const weekStart = getStartOfWeekIso(today);

  const accountNameMap = Object.fromEntries(
    (accounts || []).map((account) => [String(account.id), account.name || "Cuenta"])
  );

  const categoryNameMap = Object.fromEntries(
    (categories || []).map((category) => [
      String(category.id),
      category.name || "Categoria",
    ])
  );

  const normalizedTransactions = (transactions || []).map((tx) => ({
    ...tx,
    amount: toNumber(tx?.amount),
    date: toDateOnly(tx?.date),
  }));

  const monthTransactions = normalizedTransactions.filter((tx) =>
    String(tx.date || "").startsWith(currentMonth)
  );

  const yearTransactions = normalizedTransactions.filter((tx) =>
    String(tx.date || "").startsWith(currentYear)
  );

  const recentTransactions = [...normalizedTransactions]
    .sort((left, right) => {
      const byDate = String(right.date || "").localeCompare(String(left.date || ""));
      if (byDate !== 0) return byDate;
      return String(right.id || "").localeCompare(String(left.id || ""));
    })
    .slice(0, 5)
    .map((tx) => {
      const fallbackAccountId =
        tx.account_id || tx.account_from_id || tx.from_account_id || "";

      return {
        ...tx,
        signedAmount: getSignedAmount(tx),
        accountLabel:
          tx.type === "transfer"
            ? `${accountNameMap[String(tx.account_from_id || tx.from_account_id || "")] || "Cuenta"} -> ${
                accountNameMap[String(tx.account_to_id || tx.to_account_id || "")] || "Cuenta"
              }`
            : accountNameMap[String(fallbackAccountId)] || tx.account?.name || "Sin cuenta",
        categoryLabel:
          categoryNameMap[String(tx.category_id || "")] ||
          tx.categories?.name ||
          (tx.type === "transfer" ? "Transferencia" : "Sin categoria"),
      };
    });

  const monthSummary = monthTransactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += tx.amount;
      if (tx.type === "expense") acc.expense += Math.abs(tx.amount);
      if (!isTransfer(tx)) acc.movements += 1;
      return acc;
    },
    { income: 0, expense: 0, movements: 0 }
  );

  monthSummary.net = monthSummary.income - monthSummary.expense;

  const dailyPulse = monthTransactions.reduce(
    (acc, tx) => {
      if (tx.type !== "expense") return acc;
      const absAmount = Math.abs(tx.amount);
      if (tx.date === today) acc.todayExpense += absAmount;
      if (tx.date >= weekStart && tx.date <= today) acc.weekExpense += absAmount;
      return acc;
    },
    { todayExpense: 0, weekExpense: 0 }
  );

  const dayOfMonth = Math.max(1, Number(today.slice(8, 10)));
  dailyPulse.dailyAverage = monthSummary.expense / dayOfMonth;
  dailyPulse.weekAverage = dailyPulse.weekExpense / 7;

  const movementTransactions = normalizedTransactions
    .filter((tx) => !isTransfer(tx) && tx.date && tx.date <= today)
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));
  const lastMovementDate = movementTransactions[0]?.date || null;
  dailyPulse.lastMovementDate = lastMovementDate;
  dailyPulse.daysSinceLastMovement = lastMovementDate
    ? daysBetweenDateKeys(lastMovementDate, today)
    : null;

  const expenseDateSet = new Set(
    normalizedTransactions
      .filter((tx) => tx.type === "expense" && Math.abs(tx.amount) > 0)
      .map((tx) => tx.date)
      .filter(Boolean)
  );
  dailyPulse.expenseStreak = getExpenseStreak(expenseDateSet, today);

  const monthlyExpenseMap = new Map();
  yearTransactions.forEach((tx) => {
    if (tx.type !== "expense") return;
    const monthKey = String(tx.date || "").slice(0, 7);
    monthlyExpenseMap.set(
      monthKey,
      (monthlyExpenseMap.get(monthKey) || 0) + Math.abs(tx.amount)
    );
  });

  const monthsElapsed = Math.max(1, Number(currentMonth.slice(5, 7)));
  const averageMonthlyExpense =
    [...monthlyExpenseMap.values()].reduce((acc, amount) => acc + amount, 0) /
    monthsElapsed;

  const categoryTotalsMap = new Map();
  monthTransactions.forEach((tx) => {
    if (tx.type !== "expense" || !tx.category_id) return;
    const key = String(tx.category_id);
    categoryTotalsMap.set(key, (categoryTotalsMap.get(key) || 0) + Math.abs(tx.amount));
  });

  const totalCategoryExpense = [...categoryTotalsMap.values()].reduce(
    (acc, value) => acc + value,
    0
  );

  const topCategories = [...categoryTotalsMap.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      name: categoryNameMap[categoryId] || "Categoria",
      amount,
      percent: totalCategoryExpense > 0 ? (amount / totalCategoryExpense) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  const previousCategoryTotalsMap = new Map();
  yearTransactions.forEach((tx) => {
    if (
      tx.type !== "expense" ||
      !tx.category_id ||
      !tx.date ||
      String(tx.date).startsWith(currentMonth)
    ) {
      return;
    }

    const key = String(tx.category_id);
    previousCategoryTotalsMap.set(
      key,
      (previousCategoryTotalsMap.get(key) || 0) + Math.abs(tx.amount)
    );
  });

  const previousMonthsElapsed = Math.max(0, monthsElapsed - 1);
  const unusualCategories =
    previousMonthsElapsed > 0
      ? topCategories
          .map((category) => {
            const previousAverage =
              toNumber(previousCategoryTotalsMap.get(String(category.categoryId))) /
              previousMonthsElapsed;
            const extraAmount = category.amount - previousAverage;
            const ratio =
              previousAverage > 0 ? category.amount / previousAverage : 0;

            return {
              ...category,
              previousAverage,
              extraAmount,
              ratio,
            };
          })
          .filter(
            (category) =>
              category.previousAverage > 0 &&
              category.ratio >= 1.75 &&
              category.extraAmount >= Math.max(dailyPulse.dailyAverage, 1)
          )
          .sort((left, right) => right.extraAmount - left.extraAmount)
          .slice(0, 3)
      : [];

  const sortedBudgets = (budgets || [])
    .map((budget) => {
      const limit = toNumber(budget.limit ?? budget.limit_amount);
      const spent = toNumber(budget.spent);
      const remaining = limit - spent;
      const overAmount = Math.max(spent - limit, 0);
      const spentPct = limit > 0 ? (spent / limit) * 100 : 0;

      return {
        ...budget,
        limit,
        spent,
        remaining,
        overAmount,
        spentPct,
        category_name:
          budget.category_name ||
          categoryNameMap[String(budget.category_id || "")] ||
          "Categoria",
      };
    })
    .sort((left, right) => {
      const leftOver = left.limit > 0 && left.spent > left.limit;
      const rightOver = right.limit > 0 && right.spent > right.limit;

      if (leftOver !== rightOver) {
        return Number(rightOver) - Number(leftOver);
      }

      if (leftOver && rightOver) {
        return right.overAmount - left.overAmount;
      }

      return right.spentPct - left.spentPct;
    });

  const budgetAlerts = {
    hasBudgets: sortedBudgets.some((budget) => budget.limit > 0),
    overBudget: sortedBudgets.filter((budget) => budget.limit > 0 && budget.spent > budget.limit),
    nearLimit: sortedBudgets.filter(
      (budget) =>
        budget.limit > 0 && budget.spent <= budget.limit && budget.spentPct >= 80
    ),
    items: sortedBudgets.slice(0, 4),
  };

  const totalBudgetLimit = sortedBudgets.reduce(
    (acc, budget) => acc + (budget.limit > 0 ? budget.limit : 0),
    0
  );
  const daysInMonth = Number(lastDayOfMonthDateKey(today).slice(8, 10)) || dayOfMonth;
  const projectedExpense = dailyPulse.dailyAverage * daysInMonth;

  budgetAlerts.monthProjection = {
    dayOfMonth,
    daysInMonth,
    projectedExpense,
    totalLimit: totalBudgetLimit,
    projectedOverAmount: Math.max(projectedExpense - totalBudgetLimit, 0),
    projectedSpentPct:
      totalBudgetLimit > 0 ? (projectedExpense / totalBudgetLimit) * 100 : 0,
  };

  const completedGoalItems = (goals || [])
    .filter((goal) => {
      const status = String(goal.status || "active");
      const reserved = toNumber(goal.reserved_amount);
      const target = toNumber(goal.target_amount);

      return status === "completed" || (target > 0 && reserved >= target);
    })
    .map((goal) => ({
      ...goal,
      reserved: toNumber(goal.reserved_amount),
      target: toNumber(goal.target_amount),
    }));

  const goalItems = (goals || [])
    .filter((goal) => {
      const status = String(goal.status || "active");
      const reserved = toNumber(goal.reserved_amount);
      const target = toNumber(goal.target_amount);

      return status !== "completed" && !(target > 0 && reserved >= target);
    })
    .map((goal) => {
      const reserved = toNumber(goal.reserved_amount);
      const target = toNumber(goal.target_amount);
      return {
        ...goal,
        reserved,
        target,
        progressPct: getProgressPct(reserved, target),
        missing: Math.max(target - reserved, 0),
      };
    })
    .sort((left, right) => {
      if (Boolean(right.is_priority) !== Boolean(left.is_priority)) {
        return Number(Boolean(right.is_priority)) - Number(Boolean(left.is_priority));
      }
      return right.progressPct - left.progressPct;
    });

  const goalsSummary = {
    totalGoals: goalItems.length,
    totalReserved: goalItems.reduce((acc, goal) => acc + goal.reserved, 0),
    completedGoals: completedGoalItems.length,
    completedItems: completedGoalItems.slice(0, 3),
    items: goalItems.slice(0, 3),
  };

  const annualSummary = yearTransactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += tx.amount;
      if (tx.type === "expense") acc.expense += Math.abs(tx.amount);
      if (!isTransfer(tx)) acc.movements += 1;
      return acc;
    },
    { income: 0, expense: 0, movements: 0 }
  );

  annualSummary.net = annualSummary.income - annualSummary.expense;
  annualSummary.averageMonthlyExpense = averageMonthlyExpense;
  annualSummary.monthsElapsed = monthsElapsed;

  const balanceEntries = Object.entries(balances || {});
  const accountSnapshot = balanceEntries.reduce(
    (acc, [, balance]) => {
      acc.current += toNumber(balance?.current);
      acc.reserved += toNumber(balance?.reserved);
      acc.available += toNumber(balance?.available);
      return acc;
    },
    { current: 0, reserved: 0, available: 0 }
  );

  accountSnapshot.accountsCount = accounts.length;
  accountSnapshot.availableDaysLeft =
    dailyPulse.dailyAverage > 0
      ? accountSnapshot.available / dailyPulse.dailyAverage
      : null;
  accountSnapshot.lowAvailable =
    accountSnapshot.accountsCount > 0 &&
    (accountSnapshot.available < 0 ||
      (dailyPulse.dailyAverage > 0 && accountSnapshot.availableDaysLeft <= 3));

  const topAccounts = (accounts || [])
    .map((account, index) => {
      const accountId = String(account?.id ?? index);
      const balance = balances?.[accountId] || balances?.[account?.id] || {};

      return {
        id: accountId,
        name: account?.name || "Cuenta",
        type:
          account?.type ||
          account?.accountType ||
          account?.account_type ||
          "Cuenta",
        current: toNumber(
          balance?.current ??
            account?.current_balance ??
            account?.currentBalance ??
            account?.balance
        ),
        available: toNumber(
          balance?.available ??
            account?.available_balance ??
            account?.availableBalance
        ),
        reserved: toNumber(
          balance?.reserved ??
            account?.reserved_balance ??
            account?.reservedAmount
        ),
      };
    })
    .sort((left, right) => Math.abs(right.current) - Math.abs(left.current));

  const achievementBadges = buildAchievementBadges({
    accountSnapshot,
    budgetAlerts,
    dailyPulse,
    goalsSummary,
    monthSummary,
  });

  return {
    today,
    currentMonth,
    accountSnapshot,
    topAccounts,
    monthSummary,
    dailyPulse,
    annualSummary,
    topCategories,
    unusualCategories,
    budgetAlerts,
    goalsSummary,
    achievementBadges,
    recentTransactions,
  };
}
