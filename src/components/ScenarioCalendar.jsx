import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

function ScenarioCalendar({
  projection,
  onDateRangeSelect,
  onEventClick,
  onViewRangeChange,
}) {
  const events = projection.map((tx) => ({
    id: tx.instance_id || tx.id,
    title: `${tx.type === "income" ? "+" : "-"}RD$ ${Number(
      tx.amount
    ).toFixed(2)} — ${tx.name}`,
    date: tx.date,
    color: tx.type === "income" ? "#10b981" : "#ef4444",
    extendedProps: { realId: tx.id },
  }));

  return (
    <div className="mt-6 border-t border-slate-800/60 pt-4">

      <h3 className="text-lg font-semibold text-slate-200 mb-3">
        Vista en calendario
      </h3>

      <div
        className="
          rounded-2xl border border-slate-800
          bg-slate-950/40
          shadow-[0_18px_50px_rgba(0,0,0,0.85)]
          p-3 sm:p-4
        "
      >
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          height="auto"
          locale="es"
          selectable={true}
          select={({ startStr, endStr }) => onDateRangeSelect?.(startStr, endStr)}
          eventClick={onEventClick}
          datesSet={(info) => {
            // info.start, info.end son Date; end es EXCLUSIVO
            const startStr =
              info.startStr || info.start.toISOString().slice(0, 10);
            const endStr = info.endStr || info.end.toISOString().slice(0, 10);
            onViewRangeChange?.(startStr, endStr);
          }}
          // 👇 clase para aplicar el tema oscuro vía CSS
          className="fc-theme-dark text-xs sm:text-sm"
        />
      </div>
    </div>
  );
}

export default ScenarioCalendar;
