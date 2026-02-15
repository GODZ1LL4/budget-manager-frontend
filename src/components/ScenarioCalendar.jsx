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
    const isAI = tx.source === "advanced_forecast";
    const isProjected = Boolean(tx.isProjected);

    // ✅ base en TOKENS
    const base = isIncome ? "var(--success)" : "var(--danger)";
    const aiBorder = "var(--warning)";

    // Fondo: sólido normal, suave si es AI preview
    const backgroundColor = isAI
      ? `color-mix(in srgb, ${base} 18%, transparent)`
      : base;

    // Borde: ámbar para AI preview, si no igual al tipo
    const borderColor = isAI ? aiBorder : base;

    // Texto: claro para AI (fondo transparente), oscuro para sólido
    // (si quieres siempre claro, cambia ambos a var(--text))
    const textColor = isAI ? "var(--text)" : "var(--text-on-primary, #061018)";

    const amount = Number(tx.amount || 0);

    return {
      id: tx.instance_id || tx.id,
      title: `${isIncome ? "+" : "-"}RD$ ${amount.toFixed(2)} — ${tx.name}${
        isAI ? " (AI)" : ""
      }`,
      date: tx.date,

      // FullCalendar inline styles (tokenizados)
      backgroundColor,
      borderColor,
      textColor,

      extendedProps: {
        realId: isAI ? null : tx.real_id || tx.rule_id,
        source: isAI ? "advanced_forecast" : "scenario_projection",
        isProjected,
        category_name: tx.category_name || null,
      },

      classNames: [isAI ? "fc-ai-preview" : "fc-simulated"],
    };
  });

  return (
    <div
      className="mt-6 pt-4"
      style={{
        borderTop: "var(--border-w) solid color-mix(in srgb, var(--border-rgba) 70%, transparent)",
      }}
    >
      <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--text)" }}>
        Vista en calendario
      </h3>

      <div
        className="rounded-2xl p-3 sm:p-4 border"
        style={{
          background: "color-mix(in srgb, var(--panel) 55%, transparent)",
          borderColor: "var(--border-rgba)",
          borderWidth: "var(--border-w)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--glow-shadow)",
        }}
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
            const gridStart =
              info.startStr || info.start.toISOString().slice(0, 10);
            const gridEnd = info.endStr || info.end.toISOString().slice(0, 10);

            const d = info.view.currentStart;
            const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              "0"
            )}-${String(d.getDate()).padStart(2, "0")}`;

            onViewRangeChange?.(gridStart, gridEnd, monthStart);
          }}
          className="fc-theme-dark text-xs sm:text-sm"
        />

        {/* Leyenda (tokenizada) */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: "var(--muted)" }}>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: "var(--success)" }}
            />
            Ingreso
          </span>

          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: "var(--danger)" }}
            />
            Gasto
          </span>

          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border"
              style={{
                background: "color-mix(in srgb, var(--warning) 15%, transparent)",
                borderColor: "var(--warning)",
                borderWidth: "var(--border-w)",
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
