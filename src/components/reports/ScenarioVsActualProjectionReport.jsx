import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { HiPlus, HiRefresh } from "react-icons/hi";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FFSelect from "../FFSelect";
import Modal from "../Modal";
import {
  addDaysToDateKey,
  lastDayOfMonthDateKey,
  todayDateKey,
  withUserTimeZone,
} from "../../lib/dates/localDate";

const SELECTED_SCENARIO_KEY = "report:scenario-vs-actual:selected-scenario";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(safeNumber(value));

const formatCompact = (value) =>
  new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safeNumber(value));

const formatSignedCurrency = (value) => {
  const number = safeNumber(value);
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(number))}`;
};

const formatSignedNumber = (value) => {
  const number = safeNumber(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(0)}`;
};

function normalizeDateKey(value) {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function isDateInRange(dateKey, start, endExclusive) {
  return Boolean(dateKey && dateKey >= start && dateKey < endExclusive);
}

function isDateInMonth(dateKey, monthStart, monthEnd) {
  return Boolean(dateKey && dateKey >= monthStart && dateKey <= monthEnd);
}

function getInitialMonthStart() {
  return `${todayDateKey().slice(0, 7)}-01`;
}

function getMonthEndExclusive(monthStart) {
  return addDaysToDateKey(lastDayOfMonthDateKey(monthStart), 1);
}

function formatDateLabel(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-");
  if (!year || !month || !day) return dateKey || "";
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(monthStart) {
  const [year, month] = String(monthStart || "").split("-");
  const monthIndex = Number(month) - 1;
  const monthName = MONTH_NAMES[monthIndex] || month || "";
  return `${monthName} ${year || ""}`.trim();
}

function getCategoryLabel(tx) {
  const category = Array.isArray(tx?.categories)
    ? tx.categories[0]
    : tx?.categories;

  return (
    tx?.category_name ||
    tx?.category?.name ||
    category?.name ||
    "Sin categoria"
  );
}

function normalizeActualTransaction(tx) {
  const date = normalizeDateKey(tx?.date);
  const type =
    tx?.type === "income" || tx?.type === "expense" ? tx.type : "";

  return {
    id: tx?.id,
    source: "real",
    sourceLabel: "Real",
    date,
    type,
    amount: safeNumber(tx?.amount),
    description: tx?.description || tx?.name || "Sin descripcion",
    category_id: tx?.category_id || tx?.category?.id || null,
    category_name: getCategoryLabel(tx),
    isProjected: Boolean(tx?.isProjected),
  };
}

function normalizeScenarioTransaction(tx) {
  const date = normalizeDateKey(tx?.date);
  const type =
    tx?.type === "income" || tx?.type === "expense" ? tx.type : "";

  return {
    id: tx?.instance_id || tx?.id || tx?.rule_id,
    source: "scenario",
    sourceLabel: "Escenario",
    date,
    type,
    amount: safeNumber(tx?.amount),
    description: tx?.name || tx?.description || "Sin descripcion",
    category_id: tx?.category_id || null,
    category_name: tx?.category_name || "Sin categoria",
    account_name: tx?.account_name || null,
  };
}

function buildTotals(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      const amount = safeNumber(row.amount);
      if (row.type === "income") acc.income += amount;
      if (row.type === "expense") acc.expense += amount;
      acc.count += 1;
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0, count: 0 }
  );
}

function addExpenseByDate(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.type !== "expense" || !row.date) continue;
    map.set(row.date, (map.get(row.date) || 0) + safeNumber(row.amount));
  }
  return map;
}

function getCategoryKey(row) {
  return row.category_id
    ? `id:${row.category_id}`
    : `name:${String(row.category_name || "Sin categoria").toLowerCase()}`;
}

function buildCategoryRows({ scenarioRows, realRows }) {
  const map = new Map();

  const ensureRow = (row) => {
    const key = getCategoryKey(row);
    const current =
      map.get(key) ||
      {
        key,
        category: row.category_name || "Sin categoria",
        scenario: 0,
        real: 0,
        variance: 0,
        sortValue: 0,
      };

    if (!current.category || current.category === "Sin categoria") {
      current.category = row.category_name || current.category;
    }

    map.set(key, current);
    return current;
  };

  for (const row of scenarioRows || []) {
    if (row.type !== "expense") continue;
    ensureRow(row).scenario += safeNumber(row.amount);
  }

  for (const row of realRows || []) {
    if (row.type !== "expense") continue;
    ensureRow(row).real += safeNumber(row.amount);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      scenario: Number(row.scenario.toFixed(2)),
      real: Number(row.real.toFixed(2)),
      variance: Number((row.real - row.scenario).toFixed(2)),
      sortValue: Math.max(row.scenario, row.real),
    }))
    .filter((row) => row.scenario > 0 || row.real > 0)
    .sort((a, b) => b.sortValue - a.sortValue || a.category.localeCompare(b.category));
}

function buildTimelineRows({ scenarioRows, realRows, monthStart }) {
  const monthEnd = lastDayOfMonthDateKey(monthStart);
  const today = todayDateKey();
  const scenarioByDate = addExpenseByDate(scenarioRows);
  const realByDate = addExpenseByDate(realRows);
  const rows = [];

  let scenarioCumulative = 0;
  let realCumulative = 0;
  let cursor = monthStart;

  while (cursor <= monthEnd) {
    scenarioCumulative += safeNumber(scenarioByDate.get(cursor));
    realCumulative += safeNumber(realByDate.get(cursor));

    const isPastMonth = monthEnd < today;
    const shouldShowReal = isPastMonth || cursor <= today || realByDate.has(cursor);

    rows.push({
      date: cursor,
      day: Number(cursor.slice(8, 10)),
      scenario: Number(scenarioCumulative.toFixed(2)),
      real: shouldShowReal ? Number(realCumulative.toFixed(2)) : null,
      realArea: shouldShowReal ? Number(realCumulative.toFixed(2)) : null,
    });

    cursor = addDaysToDateKey(cursor, 1);
  }

  return rows;
}

function ReportCard({ label, value, helper, delta, tone = "neutral" }) {
  const toneColor =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--primary)";

  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-lg border p-4"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--panel) 82%, transparent), color-mix(in srgb, var(--bg-2) 52%, transparent))",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: toneColor }}
      />
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-2 text-xl font-extrabold leading-tight [overflow-wrap:anywhere]"
        style={{ color: toneColor }}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--muted)]">{helper}</p>
      <p className="mt-2 text-xs font-bold" style={{ color: toneColor }}>
        {delta}
      </p>
    </div>
  );
}

function EmptyState({ title, detail, actionLabel, onAction }) {
  return (
    <div
      className="rounded-lg border p-5 text-sm"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 72%, transparent)",
        color: "var(--text)",
      }}
    >
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-[var(--muted)]">{detail}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="ff-btn ff-btn-primary mt-4 inline-flex items-center gap-2"
        >
          <HiPlus className="h-4 w-4" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        backgroundColor: "var(--bg-3)",
        borderColor: "var(--border-rgba)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
        color: "var(--text)",
      }}
    >
      <p className="mb-1 font-bold">{row.category}</p>
      <p className="text-[var(--muted)]">
        Escenario:{" "}
        <span className="font-bold text-[var(--primary)]">
          {formatCurrency(row.scenario)}
        </span>
      </p>
      <p className="text-[var(--muted)]">
        Real:{" "}
        <span className="font-bold text-[var(--danger)]">
          {formatCurrency(row.real)}
        </span>
      </p>
      <p
        className="mt-1 font-extrabold"
        style={{ color: row.variance > 0 ? "var(--danger)" : "var(--success)" }}
      >
        Diferencia: {formatSignedCurrency(row.variance)}
      </p>
    </div>
  );
}

function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const visiblePayload = payload.filter((item) =>
    ["scenario", "real"].includes(item.dataKey)
  );

  if (!visiblePayload.length) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        backgroundColor: "var(--bg-3)",
        borderColor: "var(--border-rgba)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
        color: "var(--text)",
      }}
    >
      <p className="mb-1 font-bold">Dia {label}</p>
      {visiblePayload.map((item) => (
        <p key={item.dataKey} className="text-[var(--muted)]">
          {item.name}:{" "}
          <span className="font-bold" style={{ color: item.color }}>
            {formatCurrency(item.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function TransactionRow({ row }) {
  const isIncome = row.type === "income";
  const tone = isIncome ? "var(--success)" : "var(--danger)";

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 70%, transparent)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            {row.description}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {row.category_name || "Sin categoria"}
          </p>
        </div>
        <span className="shrink-0 text-sm font-extrabold" style={{ color: tone }}>
          {isIncome ? "+" : "-"}
          {formatCurrency(row.amount)}
        </span>
      </div>
    </div>
  );
}

function ScenarioVsActualProjectionReport({ token, onOpenScenarios }) {
  const api = import.meta.env.VITE_API_URL;
  const initialMonthStart = useMemo(() => getInitialMonthStart(), []);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(() => {
    try {
      return localStorage.getItem(SELECTED_SCENARIO_KEY) || "";
    } catch {
      return "";
    }
  });
  const [actualTransactions, setActualTransactions] = useState([]);
  const [scenarioTransactions, setScenarioTransactions] = useState([]);
  const [baseLoading, setBaseLoading] = useState(false);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [focusedMonthStart, setFocusedMonthStart] = useState(initialMonthStart);
  const [calendarRange, setCalendarRange] = useState({
    start: initialMonthStart,
    end: getMonthEndExclusive(initialMonthStart),
  });

  const baseRequestId = useRef(0);
  const projectionRequestId = useRef(0);

  const selectedScenario = useMemo(
    () =>
      scenarios.find(
        (scenario) => String(scenario.id) === String(selectedScenarioId)
      ) || null,
    [scenarios, selectedScenarioId]
  );

  const loadBaseData = useCallback(async () => {
    if (!token) return;

    const requestId = baseRequestId.current + 1;
    baseRequestId.current = requestId;
    setBaseLoading(true);
    setErrorMsg("");

    try {
      const [scenariosRes, transactionsRes] = await Promise.all([
        axios.get(`${api}/scenarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(
          `${api}/transactions/for-calendar`,
          withUserTimeZone({
            headers: { Authorization: `Bearer ${token}` },
          })
        ),
      ]);

      if (baseRequestId.current !== requestId) return;

      const incomingScenarios = Array.isArray(scenariosRes.data?.data)
        ? scenariosRes.data.data
        : [];
      const incomingTransactions = Array.isArray(transactionsRes.data?.data)
        ? transactionsRes.data.data
        : [];

      setScenarios(incomingScenarios);
      setActualTransactions(
        incomingTransactions
          .map(normalizeActualTransaction)
          .filter(
            (row) =>
              row.date &&
              !row.isProjected &&
              (row.type === "income" || row.type === "expense")
          )
      );

      setSelectedScenarioId((current) => {
        const stillExists = incomingScenarios.some(
          (scenario) => String(scenario.id) === String(current)
        );

        if (current && stillExists) return current;
        return incomingScenarios[0]?.id ? String(incomingScenarios[0].id) : "";
      });
    } catch (err) {
      console.error("Error cargando reporte escenario vs real:", err);
      setErrorMsg("No se pudieron cargar los escenarios o transacciones reales.");
    } finally {
      if (baseRequestId.current === requestId) {
        setBaseLoading(false);
      }
    }
  }, [api, token]);

  const loadProjection = useCallback(async () => {
    if (!token || !selectedScenarioId) {
      setScenarioTransactions([]);
      return;
    }

    const requestId = projectionRequestId.current + 1;
    projectionRequestId.current = requestId;
    setProjectionLoading(true);
    setErrorMsg("");

    try {
      const res = await axios.get(
        `${api}/scenarios/${selectedScenarioId}/projection`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            start: calendarRange.start,
            end: calendarRange.end,
          },
        }
      );

      if (projectionRequestId.current !== requestId) return;

      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setScenarioTransactions(
        rows
          .map(normalizeScenarioTransaction)
          .filter(
            (row) =>
              row.date && (row.type === "income" || row.type === "expense")
          )
      );
    } catch (err) {
      console.error("Error cargando proyeccion del escenario:", err);
      setScenarioTransactions([]);
      setErrorMsg("No se pudo cargar la proyeccion del escenario seleccionado.");
    } finally {
      if (projectionRequestId.current === requestId) {
        setProjectionLoading(false);
      }
    }
  }, [api, calendarRange.end, calendarRange.start, selectedScenarioId, token]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadProjection();
  }, [loadProjection]);

  useEffect(() => {
    try {
      if (selectedScenarioId) {
        localStorage.setItem(SELECTED_SCENARIO_KEY, selectedScenarioId);
      } else {
        localStorage.removeItem(SELECTED_SCENARIO_KEY);
      }
    } catch {
      return;
    }
  }, [selectedScenarioId]);

  useEffect(() => {
    if (!scenarios.length || !selectedScenarioId) return;

    const exists = scenarios.some(
      (scenario) => String(scenario.id) === String(selectedScenarioId)
    );

    if (!exists) {
      setSelectedScenarioId(scenarios[0]?.id ? String(scenarios[0].id) : "");
    }
  }, [scenarios, selectedScenarioId]);

  const monthEnd = useMemo(
    () => lastDayOfMonthDateKey(focusedMonthStart),
    [focusedMonthStart]
  );

  const actualMonthRows = useMemo(
    () =>
      actualTransactions.filter((row) =>
        isDateInMonth(row.date, focusedMonthStart, monthEnd)
      ),
    [actualTransactions, focusedMonthStart, monthEnd]
  );

  const scenarioMonthRows = useMemo(
    () =>
      scenarioTransactions.filter((row) =>
        isDateInMonth(row.date, focusedMonthStart, monthEnd)
      ),
    [focusedMonthStart, monthEnd, scenarioTransactions]
  );

  const actualTotals = useMemo(
    () => buildTotals(actualMonthRows),
    [actualMonthRows]
  );
  const scenarioTotals = useMemo(
    () => buildTotals(scenarioMonthRows),
    [scenarioMonthRows]
  );

  const categoryRows = useMemo(
    () =>
      buildCategoryRows({
        scenarioRows: scenarioMonthRows,
        realRows: actualMonthRows,
      }),
    [actualMonthRows, scenarioMonthRows]
  );

  const timelineRows = useMemo(
    () =>
      buildTimelineRows({
        scenarioRows: scenarioMonthRows,
        realRows: actualMonthRows,
        monthStart: focusedMonthStart,
      }),
    [actualMonthRows, focusedMonthStart, scenarioMonthRows]
  );

  const calendarRows = useMemo(() => {
    const actualVisible = actualTransactions.filter((row) =>
      isDateInRange(row.date, calendarRange.start, calendarRange.end)
    );
    const scenarioVisible = scenarioTransactions.filter((row) =>
      isDateInRange(row.date, calendarRange.start, calendarRange.end)
    );

    return [...scenarioVisible, ...actualVisible];
  }, [
    actualTransactions,
    calendarRange.end,
    calendarRange.start,
    scenarioTransactions,
  ]);

  const transactionsByDate = useMemo(() => {
    const grouped = {};
    for (const row of calendarRows) {
      if (!row.date) continue;
      if (!grouped[row.date]) grouped[row.date] = [];
      grouped[row.date].push(row);
    }
    return grouped;
  }, [calendarRows]);

  const calendarEvents = useMemo(
    () =>
      calendarRows.map((row, index) => {
        const isScenario = row.source === "scenario";
        const isIncome = row.type === "income";
        const typeColor = isIncome ? "var(--success)" : "var(--danger)";
        const scenarioColor = isIncome ? "var(--warning)" : "var(--primary)";
        const sourceColor = isScenario ? scenarioColor : typeColor;
        const sign = isIncome ? "+" : "-";

        return {
          id: `${row.source}-${row.id || "tx"}-${row.date}-${index}`,
          title: `${isScenario ? "Esc." : "Real"} ${sign}${formatCurrency(
            row.amount
          )} - ${row.description}`,
          date: row.date,
          start: row.date,
          allDay: true,
          backgroundColor: isScenario
            ? `color-mix(in srgb, ${sourceColor} 34%, var(--panel))`
            : `color-mix(in srgb, ${sourceColor} 72%, var(--panel))`,
          borderColor: sourceColor,
          textColor: "var(--text)",
          classNames: [isScenario ? "ff-scenario-event" : "ff-real-event"],
          extendedProps: { row },
        };
      }),
    [calendarRows]
  );

  const selectedDayRows = useMemo(
    () => transactionsByDate[selectedDate] || [],
    [selectedDate, transactionsByDate]
  );

  const selectedDayScenarioRows = selectedDayRows.filter(
    (row) => row.source === "scenario"
  );
  const selectedDayActualRows = selectedDayRows.filter(
    (row) => row.source === "real"
  );
  const selectedDayScenarioTotals = buildTotals(selectedDayScenarioRows);
  const selectedDayActualTotals = buildTotals(selectedDayActualRows);

  const categoryChartHeight = useMemo(
    () => Math.max(300, Math.min(740, 100 + categoryRows.length * 36)),
    [categoryRows.length]
  );

  const categoryAxisWidth = useMemo(() => {
    const maxLength = categoryRows.reduce(
      (max, row) => Math.max(max, String(row.category || "").length),
      0
    );
    return Math.max(130, Math.min(280, maxLength * 7));
  }, [categoryRows]);

  const handleDatesSet = useCallback((info) => {
    const nextStart = normalizeDateKey(info.startStr || info.start);
    const nextEnd = normalizeDateKey(info.endStr || info.end);
    const currentStart = normalizeDateKey(info.view?.currentStart);
    const nextFocusedMonth = currentStart || nextStart;

    if (nextStart && nextEnd) {
      setCalendarRange((current) =>
        current.start === nextStart && current.end === nextEnd
          ? current
          : { start: nextStart, end: nextEnd }
      );
    }

    if (nextFocusedMonth) {
      setFocusedMonthStart((current) =>
        current === nextFocusedMonth ? current : nextFocusedMonth
      );
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadBaseData();
    loadProjection();
  }, [loadBaseData, loadProjection]);

  const expenseDelta = actualTotals.expense - scenarioTotals.expense;
  const incomeDelta = actualTotals.income - scenarioTotals.income;
  const netDelta = actualTotals.net - scenarioTotals.net;
  const movementDelta = actualTotals.count - scenarioTotals.count;

  const isLoading = baseLoading || projectionLoading;
  const monthLabel = formatMonthLabel(focusedMonthStart);

  return (
    <div
      className="rounded-2xl border p-6 space-y-5"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 82%, transparent), var(--bg-2))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.72)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-[var(--heading)]">
            Escenario vs Ejecutado
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Compara el plan de un escenario contra las transacciones reales del
            mes visible en el calendario.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(260px,1fr)_auto] xl:w-[520px]">
          <label className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Escenario
            </span>
            <FFSelect
              value={selectedScenarioId}
              onChange={(value) => setSelectedScenarioId(String(value || ""))}
              options={scenarios}
              placeholder="Selecciona escenario"
              className="mt-1 w-full [&_.ff-input]:h-10 [&_.ff-input]:py-0"
              getOptionValue={(scenario) => scenario.id}
              getOptionLabel={(scenario) => scenario.name}
              disabled={baseLoading || scenarios.length === 0}
              clearable={false}
            />
          </label>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={!token || isLoading}
            className="ff-btn ff-btn-outline inline-flex h-10 items-center justify-center gap-2 self-end"
            title="Refrescar reporte"
          >
            <HiRefresh className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refrescar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--muted)]">Mes:</span>
        <strong className="text-[var(--text)]">{monthLabel}</strong>
        {selectedScenario ? (
          <>
            <span className="text-[var(--muted)]">| Escenario:</span>
            <strong className="text-[var(--text)]">{selectedScenario.name}</strong>
          </>
        ) : null}
        {isLoading ? (
          <span className="text-xs text-[var(--muted)]">Actualizando...</span>
        ) : null}
      </div>

      {errorMsg ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 42%, var(--border-rgba))",
            background: "color-mix(in srgb, var(--danger) 10%, var(--panel))",
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      {!baseLoading && scenarios.length === 0 ? (
        <EmptyState
          title="No hay escenarios guardados."
          detail="Crea un escenario primero para comparar sus transacciones contra la realidad."
          actionLabel={onOpenScenarios ? "Crear escenario" : ""}
          onAction={onOpenScenarios}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReportCard
              label="Gasto real"
              value={formatCurrency(actualTotals.expense)}
              helper={`Escenario ${formatCurrency(scenarioTotals.expense)}`}
              delta={`Diferencia ${formatSignedCurrency(expenseDelta)}`}
              tone={expenseDelta > 0 ? "danger" : "success"}
            />
            <ReportCard
              label="Ingreso real"
              value={formatCurrency(actualTotals.income)}
              helper={`Escenario ${formatCurrency(scenarioTotals.income)}`}
              delta={`Diferencia ${formatSignedCurrency(incomeDelta)}`}
              tone={incomeDelta >= 0 ? "success" : "warning"}
            />
            <ReportCard
              label="Neto real"
              value={formatCurrency(actualTotals.net)}
              helper={`Escenario ${formatCurrency(scenarioTotals.net)}`}
              delta={`Diferencia ${formatSignedCurrency(netDelta)}`}
              tone={netDelta >= 0 ? "success" : "danger"}
            />
            <ReportCard
              label="Movimientos reales"
              value={String(actualTotals.count)}
              helper={`Escenario ${scenarioTotals.count}`}
              delta={`Diferencia ${formatSignedNumber(movementDelta)}`}
              tone="neutral"
            />
          </div>

          <section
            className="rounded-lg border p-4"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 66%, transparent)",
            }}
          >
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h4 className="text-base font-bold text-[var(--text)]">
                  Calendario comparativo
                </h4>
                <p className="text-sm text-[var(--muted)]">
                  Los eventos marcados como Esc. pertenecen al escenario; Real
                  viene de tus transacciones registradas.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[var(--primary)]" />
                  Escenario
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[var(--danger)]" />
                  Gasto real
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[var(--success)]" />
                  Ingreso real
                </span>
              </div>
            </div>

            <div className="ff-transactions-calendar">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                height="auto"
                locale="es"
                dayMaxEvents={4}
                moreLinkText="mas"
                dateClick={({ dateStr }) => setSelectedDate(dateStr)}
                eventClick={(info) => {
                  info.jsEvent?.preventDefault?.();
                  const rowDate = info.event.extendedProps?.row?.date;
                  setSelectedDate(rowDate || info.event.startStr?.slice(0, 10) || "");
                }}
                datesSet={handleDatesSet}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 66%, transparent)",
              }}
            >
              <div className="mb-4">
                <h4 className="text-base font-bold text-[var(--text)]">
                  Categorias: escenario vs real
                </h4>
                <p className="text-sm text-[var(--muted)]">
                  Comparativo horizontal de gastos por categoria en {monthLabel}.
                </p>
              </div>

              {categoryRows.length === 0 ? (
                <p className="text-sm italic text-[var(--muted)]">
                  No hay gastos por categoria para comparar en este mes.
                </p>
              ) : (
                <div className="w-full" style={{ height: categoryChartHeight }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={categoryRows}
                      layout="vertical"
                      margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                      barCategoryGap={8}
                    >
                      <CartesianGrid
                        stroke="color-mix(in srgb, var(--border-rgba) 60%, transparent)"
                        strokeDasharray="4 4"
                      />
                      <XAxis
                        type="number"
                        stroke="var(--muted)"
                        tick={{ fill: "var(--text)", fontSize: 12 }}
                        tickFormatter={formatCompact}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={categoryAxisWidth}
                        stroke="var(--muted)"
                        tick={{ fill: "var(--text)", fontSize: 12 }}
                      />
                      <Tooltip content={<CategoryTooltip />} />
                      <Legend
                        wrapperStyle={{ color: "var(--text)", fontSize: 13 }}
                      />
                      <Bar
                        dataKey="scenario"
                        name="Escenario"
                        fill="var(--primary)"
                        radius={[6, 6, 6, 6]}
                      />
                      <Bar
                        dataKey="real"
                        name="Real"
                        fill="var(--danger)"
                        radius={[6, 6, 6, 6]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 66%, transparent)",
              }}
            >
              <div className="mb-4">
                <h4 className="text-base font-bold text-[var(--text)]">
                  Burn rate del escenario
                </h4>
                <p className="text-sm text-[var(--muted)]">
                  Gasto acumulado diario del escenario contra el gasto real.
                </p>
              </div>

              <div className="h-[360px] w-full">
                <ResponsiveContainer>
                  <ComposedChart
                    data={timelineRows}
                    margin={{ top: 8, right: 18, bottom: 8, left: 4 }}
                  >
                    <CartesianGrid
                      stroke="color-mix(in srgb, var(--border-rgba) 60%, transparent)"
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="day"
                      stroke="var(--muted)"
                      tick={{ fill: "var(--text)", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="var(--muted)"
                      tick={{ fill: "var(--text)", fontSize: 12 }}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip content={<TimelineTooltip />} />
                    <Legend
                      wrapperStyle={{ color: "var(--text)", fontSize: 13 }}
                      payload={[
                        {
                          id: "scenario",
                          value: "Escenario",
                          type: "line",
                          color: "var(--primary)",
                        },
                        {
                          id: "real",
                          value: "Real",
                          type: "line",
                          color: "var(--danger)",
                        },
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="realArea"
                      name="Area real"
                      stroke="none"
                      fill="var(--danger)"
                      fillOpacity={0.08}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="scenario"
                      name="Escenario"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="real"
                      name="Real"
                      stroke="var(--danger)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}

      <Modal
        isOpen={Boolean(selectedDate)}
        onClose={() => setSelectedDate("")}
        title={
          selectedDate
            ? `Escenario vs real del ${formatDateLabel(selectedDate)}`
            : "Detalle diario"
        }
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReportCard
              label="Escenario del dia"
              value={formatCurrency(selectedDayScenarioTotals.expense)}
              helper={`Ingresos ${formatCurrency(selectedDayScenarioTotals.income)}`}
              delta={`Neto ${formatSignedCurrency(selectedDayScenarioTotals.net)}`}
              tone="neutral"
            />
            <ReportCard
              label="Real del dia"
              value={formatCurrency(selectedDayActualTotals.expense)}
              helper={`Ingresos ${formatCurrency(selectedDayActualTotals.income)}`}
              delta={`Neto ${formatSignedCurrency(selectedDayActualTotals.net)}`}
              tone={
                selectedDayActualTotals.expense > selectedDayScenarioTotals.expense
                  ? "danger"
                  : "success"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h5 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Escenario
              </h5>
              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {selectedDayScenarioRows.length ? (
                  selectedDayScenarioRows.map((row, index) => (
                    <TransactionRow
                      key={`scenario-${row.id || index}-${row.date}`}
                      row={row}
                    />
                  ))
                ) : (
                  <p className="rounded-lg border p-3 text-sm italic text-[var(--muted)] border-[var(--border-rgba)]">
                    Sin transacciones de escenario para este dia.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h5 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Real
              </h5>
              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {selectedDayActualRows.length ? (
                  selectedDayActualRows.map((row, index) => (
                    <TransactionRow
                      key={`real-${row.id || index}-${row.date}`}
                      row={row}
                    />
                  ))
                ) : (
                  <p className="rounded-lg border p-3 text-sm italic text-[var(--muted)] border-[var(--border-rgba)]">
                    Sin transacciones reales para este dia.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ScenarioVsActualProjectionReport;
