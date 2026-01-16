import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

function ScenarioCalendar({
  projection,
  onDateRangeSelect,
  onEventClick,
  onViewRangeChange,
}) {
  const events = (projection || []).map((tx) => {
    const isIncome = tx.type === "income";
    const isAI = tx.source === "advanced_forecast"; // 👈 viene del preview
    const isProjected = Boolean(tx.isProjected); // ya lo usas en tu sistema

    // Colores base
    const baseColor = isIncome ? "#10b981" : "#ef4444";

    // Si es AI preview, lo diferenciamos visualmente (borde + fondo más suave)
    const backgroundColor = isAI
      ? isIncome
        ? "rgba(16,185,129,0.18)"
        : "rgba(239,68,68,0.18)"
      : baseColor;

    const borderColor = isAI ? "#f59e0b" : baseColor; // ámbar para AI
    const textColor = isAI ? "#e2e8f0" : "#0b1220"; // texto claro en AI, oscuro en sólido

    const amount = Number(tx.amount || 0);

    return {
      id: tx.instance_id || tx.id,
      title: `${isIncome ? "+" : "-"}RD$ ${amount.toFixed(2)} — ${tx.name}${
        isAI ? " (AI)" : ""
      }`,
      date: tx.date,

      // FullCalendar styles
      backgroundColor,
      borderColor,
      textColor,

      // ✅ Importante: solo pasar realId si NO es AI preview
      extendedProps: {
        realId: isAI ? null : tx.real_id || tx.rule_id,
        source: isAI ? "advanced_forecast" : "scenario_projection",
        isProjected,
        category_name: tx.category_name || null,
      },

      // Clase CSS para afinar estilos con tailwind/css si quieres
      classNames: [isAI ? "fc-ai-preview" : "fc-simulated"],
    };
  });

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
          select={({ startStr, endStr }) =>
            onDateRangeSelect?.(startStr, endStr)
          }
          eventClick={onEventClick}
          datesSet={(info) => {
            const gridStart =
              info.startStr || info.start.toISOString().slice(0, 10);
            const gridEnd = info.endStr || info.end.toISOString().slice(0, 10);

            const d = info.view.currentStart;
            const monthStart = `${d.getFullYear()}-${String(
              d.getMonth() + 1
            ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

            onViewRangeChange?.(gridStart, gridEnd, monthStart);
          }}
          className="fc-theme-dark text-xs sm:text-sm"
        />

        {/* ✅ Leyenda */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: "#10b981" }}
            />
            Ingreso
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: "#ef4444" }}
            />
            Gasto
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border"
              style={{
                background: "rgba(245,158,11,0.15)",
                borderColor: "#f59e0b",
              }}
            />
            AI Preview (no editable)
          </span>
        </div>
      </div>
    </div>
  );
}

export default ScenarioCalendar;
