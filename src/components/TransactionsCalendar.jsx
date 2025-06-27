import { useEffect, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

function TransactionsCalendar({ token }) {
  const [events, setEvents] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/transactions/for-calendar`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const data = res.data.data || [];
        const mapped = data.map((tx) => ({
          title: `${tx.type === "income" ? "+" : "-"}RD$ ${tx.amount.toFixed(
            2
          )} — ${tx.description || "Sin descripción"}`,
          date: tx.date,
          color: tx.type === "income" ? "#10b981" : "#ef4444",
        }));

        setEvents(mapped);
      })
      .catch((err) => {
        console.error("❌ Error al cargar calendario:", err);
      });
  }, [token]);

  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      events={events}
      height="auto"
      locale="es"
    />
  );
}

export default TransactionsCalendar;
