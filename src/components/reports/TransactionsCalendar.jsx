import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

function TransactionsCalendar({ token, isOpen = true }) {
  const [events, setEvents] = useState([]);
  const [totalsByDate, setTotalsByDate] = useState({});
  const api = import.meta.env.VITE_API_URL;

  const calRef = useRef(null);

  // Aplica/actualiza tooltips en todas las celdas visibles (sin depender de dayCellDidMount)
  const applyTooltips = () => {
    const calendarApi = calRef.current?.getApi?.();
    if (!calendarApi) return;

    const rootEl = calendarApi.el;
    if (!rootEl) return;

    const dayEls = rootEl.querySelectorAll(".fc-daygrid-day[data-date]");
    dayEls.forEach((el) => {
      const dateStr = el.getAttribute("data-date"); // YYYY-MM-DD
      const t = totalsByDate[dateStr];

      if (!t) {
        el.removeAttribute("title");
        const num = el.querySelector(".fc-daygrid-day-number");
        if (num) num.removeAttribute("title");
        return;
      }

      const tip = `Ingresos: RD$ ${t.income.toFixed(2)}\nGastos: RD$ ${t.expense.toFixed(2)}`;

      el.setAttribute("title", tip);
      const num = el.querySelector(".fc-daygrid-day-number");
      if (num) num.setAttribute("title", tip);
    });
  };

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/transactions/for-calendar`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const data = res.data.data || [];

        // ✅ Totales SOLO con reales (no proyectadas)
        const realTxs = data.filter((tx) => !tx.isProjected);

        const totals = {};
        for (const tx of realTxs) {
          const d = tx.date;
          if (!totals[d]) totals[d] = { income: 0, expense: 0 };
          const amt = Number(tx.amount || 0);
          if (tx.type === "income") totals[d].income += amt;
          if (tx.type === "expense") totals[d].expense += amt;
        }
        setTotalsByDate(totals);

        // ✅ Eventos: SÍ incluye proyectadas (solo no cuentan en totals)
        const mapped = data.map((tx) => {
          const amt = Number(tx.amount || 0);
          const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
          const baseColor =
            tx.type === "income"
              ? "var(--success)"
              : tx.type === "expense"
              ? "var(--danger)"
              : "var(--muted)";

          // Proyectadas: mismo color pero más “soft”
          const color = tx.isProjected
            ? `color-mix(in srgb, ${baseColor} 55%, transparent)`
            : baseColor;

          const suffix = tx.isProjected ? " (proj.)" : "";

          return {
            title: `${sign}RD$ ${amt.toFixed(2)} — ${tx.description || "Sin descripción"}${suffix}`,
            date: tx.date,
            color,
            textColor: "var(--text)",
            classNames: tx.isProjected ? ["ff-projected"] : [],
          };
        });

        setEvents(mapped);
      })
      .catch((err) => {
        console.error("❌ Error al cargar calendario:", err);
      });
  }, [token, api]);

  // 🔁 Cuando cambian los totales, actualiza tooltips en el mes actual (sin cambiar de mes)
  useEffect(() => {
    applyTooltips();
  }, [totalsByDate]);

  // 📦 Cuando abres el collapse, FullCalendar necesita updateSize/render
  useEffect(() => {
    if (!isOpen) return;

    const api = calRef.current?.getApi?.();
    if (!api) return;

    // doble tick para asegurar layout estable
    requestAnimationFrame(() => {
      api.updateSize();
      applyTooltips();
      requestAnimationFrame(() => {
        api.updateSize();
        applyTooltips();
      });
    });
  }, [isOpen, events.length]);

  return (
    <FullCalendar
      ref={calRef}
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      events={events}
      height="auto"
      locale="es"
      // Cada vez que cambias de mes/semana, re-aplica tooltips
      datesSet={() => {
        applyTooltips();
      }}
    />
  );
}

export default TransactionsCalendar;
