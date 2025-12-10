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
        const mapped = data.map((tx) => {
          let color;
        
          if (tx.type === "income") {
            color = "#10b981"; // verde
          } else if (tx.type === "expense") {
            color = "#ef4444"; // rojo
          } else if (tx.type === "transfer") {
            color = "#64748b"; // 🟦 gris neutral (slate-500)
          }
        
          return {
            title: `${tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}RD$ ${tx.amount.toFixed(
              2
            )} — ${tx.description || "Sin descripción"}`,
            date: tx.date,
            color,
          };
        });
        

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
