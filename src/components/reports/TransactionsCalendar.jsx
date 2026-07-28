import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import Modal from "../Modal";
import { useAppPreferences } from "../../context/AppPreferencesContext";

function dateToDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-");
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}/${year}`;
}

function getTypeTone(type) {
  if (type === "income") return "var(--success)";
  if (type === "transfer") return "var(--primary)";
  if (type === "expense") return "var(--danger)";
  return "var(--muted)";
}

function getCategoryLabel(tx, categoryNameById = {}) {
  if (tx.type === "transfer") return "Transferencia";

  const category = Array.isArray(tx.categories)
    ? tx.categories[0]
    : tx.categories;
  const categoryId = tx.category_id || category?.id || tx.category?.id;

  return (
    tx.category_name ||
    category?.name ||
    tx.category?.name ||
    categoryNameById[String(categoryId)] ||
    "Sin categoria"
  );
}

function SummaryCard({ label, value, tone = "var(--text)" }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "color-mix(in srgb, var(--panel) 74%, transparent)",
        border: "1px solid var(--border-rgba)",
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function TransactionsCalendar({ token, isOpen = true, mobileCompact = false }) {
  const { formatCurrency } = useAppPreferences();
  const [transactions, setTransactions] = useState([]);
  const [categoryNameById, setCategoryNameById] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const api = import.meta.env.VITE_API_URL;

  const calRef = useRef(null);

  const transactionsByDate = useMemo(() => {
    const grouped = {};

    for (const tx of transactions) {
      if (!tx.date) continue;
      if (!grouped[tx.date]) grouped[tx.date] = [];
      grouped[tx.date].push(tx);
    }

    return grouped;
  }, [transactions]);

  const totalsByDate = useMemo(() => {
    const totals = {};

    for (const tx of transactions) {
      if (tx.isProjected || !tx.date) continue;

      if (!totals[tx.date]) totals[tx.date] = { income: 0, expense: 0 };

      const amount = Number(tx.amount || 0);
      if (tx.type === "income") totals[tx.date].income += amount;
      if (tx.type === "expense") totals[tx.date].expense += amount;
    }

    return totals;
  }, [transactions]);

  const events = useMemo(
    () =>
      transactions.map((tx, index) => {
        const amount = Number(tx.amount || 0);
        const sign =
          tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
        const baseColor = getTypeTone(tx.type);
        const color = tx.isProjected
          ? `color-mix(in srgb, ${baseColor} 55%, transparent)`
          : baseColor;
        const suffix = tx.isProjected ? " (proj.)" : "";

        return {
          id: `${tx.id || "tx"}-${tx.date || "date"}-${index}`,
          title: `${sign}${formatCurrency(amount)} - ${
            tx.description || "Sin descripcion"
          }${suffix}`,
          date: tx.date,
          color,
          textColor: "var(--text)",
          classNames: tx.isProjected ? ["ff-projected"] : [],
          extendedProps: {
            transaction: tx,
          },
        };
      }),
    [formatCurrency, transactions]
  );
  const calendarEvents = mobileCompact ? [] : events;

  const selectedDayTransactions = useMemo(
    () => transactionsByDate[selectedDate] || [],
    [selectedDate, transactionsByDate]
  );

  const selectedDayTotals = useMemo(
    () =>
      selectedDayTransactions.reduce(
        (acc, tx) => {
          if (tx.isProjected) return acc;

          const amount = Number(tx.amount || 0);
          if (tx.type === "income") acc.income += amount;
          if (tx.type === "expense") acc.expense += amount;
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [selectedDayTransactions]
  );

  const selectedDayNet = selectedDayTotals.income - selectedDayTotals.expense;

  const applyTooltips = useCallback(() => {
    const calendarApi = calRef.current?.getApi?.();
    if (!calendarApi) return;

    const rootEl = calendarApi.el;
    if (!rootEl) return;

    const dayEls = rootEl.querySelectorAll(".fc-daygrid-day[data-date]");
    dayEls.forEach((el) => {
      const dateStr = el.getAttribute("data-date");
      const total = totalsByDate[dateStr];
      const dayNumber = el.querySelector(".fc-daygrid-day-number");

      if (!total) {
        el.removeAttribute("title");
        dayNumber?.removeAttribute("title");
        return;
      }

      const tip = `Ingresos: ${formatCurrency(
        total.income
      )}\nGastos: ${formatCurrency(total.expense)}`;

      el.setAttribute("title", tip);
      dayNumber?.setAttribute("title", tip);
    });
  }, [formatCurrency, totalsByDate]);

  useEffect(() => {
    if (!token) return;

    const authConfig = {
      headers: { Authorization: `Bearer ${token}` },
    };

    Promise.all([
      axios.get(`${api}/transactions/for-calendar`, authConfig),
      axios.get(`${api}/categories`, authConfig).catch(() => ({
        data: { data: [] },
      })),
    ])
      .then(([transactionsRes, categoriesRes]) => {
        const categories = categoriesRes.data.data || [];
        const namesById = {};

        categories.forEach((category) => {
          if (category?.id) {
            namesById[String(category.id)] = category.name;
          }
        });

        setCategoryNameById(namesById);
        setTransactions(transactionsRes.data.data || []);
      })
      .catch((err) => {
        console.error("Error al cargar calendario:", err);
      });
  }, [token, api]);

  useEffect(() => {
    applyTooltips();
  }, [applyTooltips]);

  useEffect(() => {
    if (!isOpen) return;

    const calendarApi = calRef.current?.getApi?.();
    if (!calendarApi) return;

    requestAnimationFrame(() => {
      calendarApi.updateSize();
      applyTooltips();
      requestAnimationFrame(() => {
        calendarApi.updateSize();
        applyTooltips();
      });
    });
  }, [applyTooltips, calendarEvents.length, isOpen]);

  return (
    <div
      className={`ff-transactions-calendar ${
        mobileCompact ? "ff-transactions-calendar--mobile" : ""
      }`}
    >
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={calendarEvents}
        height="auto"
        locale="es"
        dayMaxEvents={3}
        moreLinkText="mas"
        dateClick={({ dateStr }) => setSelectedDate(dateStr)}
        eventClick={(info) => {
          info.jsEvent?.preventDefault?.();
          const txDate = info.event.extendedProps?.transaction?.date;
          setSelectedDate(txDate || info.event.startStr?.slice(0, 10) || "");
        }}
        dayCellClassNames={(info) => {
          const dateKey = info.dateStr || dateToDateKey(info.date);
          return mobileCompact && transactionsByDate[dateKey]?.length
            ? ["ff-calendar-day-has-transactions"]
            : [];
        }}
        datesSet={() => {
          applyTooltips();
        }}
      />

      <Modal
        isOpen={Boolean(selectedDate)}
        onClose={() => setSelectedDate("")}
        title={
          selectedDate
            ? `Transacciones del ${formatDateLabel(selectedDate)}`
            : "Transacciones"
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Ingresos"
              value={formatCurrency(selectedDayTotals.income)}
              tone="var(--success)"
            />
            <SummaryCard
              label="Gastos"
              value={formatCurrency(selectedDayTotals.expense)}
              tone="var(--danger)"
            />
            <SummaryCard
              label="Neto"
              value={formatCurrency(selectedDayNet)}
              tone={selectedDayNet >= 0 ? "var(--success)" : "var(--danger)"}
            />
          </div>

          {selectedDayTransactions.length === 0 ? (
            <p
              className="rounded-lg border p-4 text-sm text-[var(--muted)]"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 72%, transparent)",
              }}
            >
              No hay transacciones registradas para este dia.
            </p>
          ) : (
            <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
              {selectedDayTransactions.map((tx, index) => {
                const amount = Number(tx.amount || 0);
                const isIncome = tx.type === "income";
                const isTransfer = tx.type === "transfer";

                return (
                  <div
                    key={`${tx.id || "tx"}-${tx.date || selectedDate}-${index}`}
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: tx.isProjected
                        ? "color-mix(in srgb, var(--warning) 44%, var(--border-rgba))"
                        : "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 78%, transparent)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">
                          {tx.description || "Sin descripcion"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                          <span>{getCategoryLabel(tx, categoryNameById)}</span>
                          {tx.isProjected ? (
                            <span
                              className="rounded-full border px-2 py-0.5 font-semibold"
                              style={{
                                borderColor:
                                  "color-mix(in srgb, var(--warning) 45%, transparent)",
                                color: "var(--warning)",
                              }}
                            >
                              Proyectada
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span
                        className="shrink-0 text-right text-sm font-bold"
                        style={{ color: getTypeTone(tx.type) }}
                      >
                        {isIncome ? "+" : isTransfer ? "" : "-"}
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setSelectedDate("")}
              className="ff-btn ff-btn-outline"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TransactionsCalendar;
