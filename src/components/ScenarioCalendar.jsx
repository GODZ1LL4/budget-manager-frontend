import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

function ScenarioCalendar({ projection, onDateRangeSelect, onEventClick }) {
  const events = projection.map((tx) => ({
    id: tx.instance_id || tx.id, // ✅ clave única para el calendario
    title: `${tx.type === "income" ? "+" : "-"}RD$ ${tx.amount.toFixed(2)} — ${tx.name}`,
    date: tx.date,
    color: tx.type === "income" ? "#10b981" : "#ef4444",
    extendedProps: {
      realId: tx.id, // ✅ ID real para llamadas a backend
    },
  }));
  
  

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Vista en calendario
      </h3>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        height="auto"
        locale="es"
        selectable={true}
        select={({ startStr, endStr }) => {
          if (onDateRangeSelect) {
            onDateRangeSelect(startStr, endStr);
          }
        }}
        eventClick={onEventClick} // ✅ aquí está la clave
      />
    </div>
  );
}

export default ScenarioCalendar;
