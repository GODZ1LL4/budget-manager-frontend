import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { currentMonthRange, withUserTimeZone } from "../../lib/dates/localDate";

const money = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const compactMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const accountKey = (id) => id || "__no_account__";

const pathLabel = (path = []) =>
  Array.isArray(path) && path.length > 0 ? path.join(" → ") : "Sin ruta";

function FlowMetric({ label, value, tone = "neutral", note = "" }) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--text)";

  return (
    <div
      className="rounded-2xl px-4 py-3 min-w-0"
      style={{
        border: "1px solid var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 72%, transparent)",
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      <p className="mt-2 text-lg font-extrabold truncate" style={{ color }}>
        {money(value)}
      </p>
      {note ? (
        <p className="mt-1 text-xs truncate" style={{ color: "var(--muted)" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

function FlowCanvas({ accounts, links, focusedKey, onFocus }) {
  const visibleAccounts = useMemo(() => {
    if (!focusedKey) return accounts.slice(0, 9);

    const connected = new Set([focusedKey]);
    links.forEach((link) => {
      const fromKey = accountKey(link.from_account_id);
      const toKey = accountKey(link.to_account_id);
      if (fromKey === focusedKey) connected.add(toKey);
      if (toKey === focusedKey) connected.add(fromKey);
    });

    return accounts.filter((account) => connected.has(account.account_key)).slice(0, 9);
  }, [accounts, focusedKey, links]);

  const height = Math.max(300, visibleAccounts.length * 82 + 90);
  const maxValue = Math.max(
    1,
    ...visibleAccounts.flatMap((account) => [
      Number(account.income || 0),
      Number(account.expense || 0),
    ]),
    ...links.map((link) => Number(link.amount || 0))
  );

  const scaleWidth = (value) =>
    Math.max(2, Math.min(14, 2 + Math.sqrt(Number(value) || 0) / Math.sqrt(maxValue) * 12));

  const positions = visibleAccounts.reduce((acc, account, index) => {
    acc[account.account_key] = {
      x: 360,
      y: 72 + index * 82,
    };
    return acc;
  }, {});

  const visibleKeys = new Set(visibleAccounts.map((account) => account.account_key));
  const visibleLinks = links.filter((link) => {
    const fromKey = accountKey(link.from_account_id);
    const toKey = accountKey(link.to_account_id);
    return visibleKeys.has(fromKey) && visibleKeys.has(toKey);
  });

  const isDimmedAccount = (key) => focusedKey && key !== focusedKey;
  const isDimmedTransfer = (link) => {
    if (!focusedKey) return false;
    return (
      accountKey(link.from_account_id) !== focusedKey &&
      accountKey(link.to_account_id) !== focusedKey
    );
  };

  if (!visibleAccounts.length) {
    return (
      <div
        className="rounded-2xl px-4 py-8 text-sm text-center"
        style={{
          border: "1px solid var(--border-rgba)",
          color: "var(--muted)",
          background: "color-mix(in srgb, var(--panel) 60%, transparent)",
        }}
      >
        No hay cuentas con movimientos para el periodo seleccionado.
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl"
      style={{
        border: "1px solid var(--border-rgba)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--bg-2) 78%, var(--panel)), color-mix(in srgb, var(--panel) 78%, transparent))",
      }}
    >
      <svg
        viewBox={`0 0 980 ${height}`}
        className="min-w-[920px] w-full"
        style={{ height }}
        role="img"
        aria-label="Trazabilidad de ingresos, gastos y transferencias entre cuentas"
      >
        <defs>
          <filter id="flowGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="980" height={height} fill="transparent" />

        <g>
          <rect
            x="36"
            y="26"
            width="180"
            height="54"
            rx="16"
            fill="color-mix(in srgb, var(--success) 12%, var(--panel))"
            stroke="color-mix(in srgb, var(--success) 35%, var(--border-rgba))"
          />
          <text x="56" y="50" fill="var(--success)" fontSize="12" fontWeight="800">
            ENTRADAS
          </text>
          <text x="56" y="68" fill="var(--text)" fontSize="12">
            Ingresos externos
          </text>

          <rect
            x="764"
            y="26"
            width="180"
            height="54"
            rx="16"
            fill="color-mix(in srgb, var(--danger) 12%, var(--panel))"
            stroke="color-mix(in srgb, var(--danger) 35%, var(--border-rgba))"
          />
          <text x="784" y="50" fill="var(--danger)" fontSize="12" fontWeight="800">
            SALIDAS
          </text>
          <text x="784" y="68" fill="var(--text)" fontSize="12">
            Gastos externos
          </text>
        </g>

        {visibleAccounts.map((account) => {
          const position = positions[account.account_key];
          const income = Number(account.income || 0);
          const expense = Number(account.expense || 0);
          const dimmed = isDimmedAccount(account.account_key);

          return (
            <g key={`external-${account.account_key}`} opacity={dimmed ? 0.28 : 1}>
              {income > 0 ? (
                <path
                  d={`M 216 54 C 265 ${position.y}, 292 ${position.y}, 356 ${position.y}`}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth={scaleWidth(income)}
                  strokeLinecap="round"
                  opacity="0.6"
                  filter="url(#flowGlow)"
                >
                  <title>{`Ingreso hacia ${account.account_name}: ${money(income)}`}</title>
                </path>
              ) : null}

              {expense > 0 ? (
                <path
                  d={`M 628 ${position.y} C 700 ${position.y}, 724 ${position.y}, 764 54`}
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth={scaleWidth(expense)}
                  strokeLinecap="round"
                  opacity="0.55"
                  filter="url(#flowGlow)"
                >
                  <title>{`Gasto desde ${account.account_name}: ${money(expense)}`}</title>
                </path>
              ) : null}
            </g>
          );
        })}

        {visibleLinks.map((link, index) => {
          const fromKey = accountKey(link.from_account_id);
          const toKey = accountKey(link.to_account_id);
          const from = positions[fromKey];
          const to = positions[toKey];
          if (!from || !to) return null;

          const bend = 660 + (index % 3) * 26;
          const dimmed = isDimmedTransfer(link);
          const color = dimmed ? "var(--muted)" : "var(--primary)";

          return (
            <g key={`${fromKey}-${toKey}-${index}`} opacity={dimmed ? 0.2 : 0.88}>
              <path
                d={`M 628 ${from.y} C ${bend} ${from.y}, ${bend} ${to.y}, 628 ${to.y}`}
                fill="none"
                stroke={color}
                strokeWidth={scaleWidth(link.amount)}
                strokeLinecap="round"
                strokeDasharray={Math.abs(from.y - to.y) < 4 ? "0" : "0"}
              >
                <title>
                  {`${link.from_account_name} a ${link.to_account_name}: ${money(link.amount)}`}
                </title>
              </path>
              <text
                x={bend + 8}
                y={(from.y + to.y) / 2 - 4}
                fill="var(--text)"
                fontSize="11"
                fontWeight="700"
              >
                {compactMoney(link.amount)}
              </text>
            </g>
          );
        })}

        {visibleAccounts.map((account) => {
          const position = positions[account.account_key];
          const focused = focusedKey === account.account_key;
          const dimmed = isDimmedAccount(account.account_key);
          const netColor = account.net_total >= 0 ? "var(--success)" : "var(--danger)";

          return (
            <g
              key={account.account_key}
              transform={`translate(${position.x}, ${position.y - 28})`}
              opacity={dimmed ? 0.45 : 1}
              style={{ cursor: "pointer" }}
              onClick={() => onFocus(focused ? "" : account.account_key)}
            >
              <rect
                width="268"
                height="56"
                rx="16"
                fill={
                  focused
                    ? "color-mix(in srgb, var(--primary) 18%, var(--panel))"
                    : "color-mix(in srgb, var(--panel) 88%, transparent)"
                }
                stroke={
                  focused
                    ? "color-mix(in srgb, var(--primary) 72%, var(--border-rgba))"
                    : "var(--border-rgba)"
                }
                strokeWidth={focused ? 2 : 1}
              />
              <text x="16" y="23" fill="var(--text)" fontSize="13" fontWeight="800">
                {account.account_name}
              </text>
              <text x="16" y="43" fill="var(--muted)" fontSize="11">
                Entra {compactMoney(account.total_in)} · Sale {compactMoney(account.total_out)}
              </text>
              <text x="178" y="35" fill={netColor} fontSize="12" fontWeight="800">
                {compactMoney(account.net_total)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AccountFlowTraceReport({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const defaultRange = useMemo(() => currentMonthRange(), []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedAccountKey, setFocusedAccountKey] = useState("");

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    axios
      .get(
        `${api}/analytics/account-flow-trace`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
          params: {
            date_from: appliedRange.from,
            date_to: appliedRange.to,
          },
        })
      )
      .then((res) => setPayload(res?.data || null))
      .catch((err) => {
        console.error("Error cargando trazabilidad entre cuentas:", err);
        setError(
          err.response?.data?.error ||
            "No se pudo cargar la trazabilidad entre cuentas."
        );
        setPayload(null);
      })
      .finally(() => setLoading(false));
  }, [api, appliedRange, token]);

  const accounts = payload?.accounts || [];
  const links = payload?.links || [];
  const summary = payload?.summary || {};
  const analysis = payload?.analysis || {};
  const insights = analysis?.insights || [];
  const spendingTraces = analysis?.spending_traces || [];
  const accountRoles = analysis?.account_roles || [];

  const focusedAccount = useMemo(
    () => accounts.find((account) => account.account_key === focusedAccountKey) || null,
    [accounts, focusedAccountKey]
  );

  const rolesByAccountId = useMemo(() => {
    return Object.fromEntries(
      accountRoles.map((role) => [accountKey(role.account_id), role])
    );
  }, [accountRoles]);

  const handleApplyRange = () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setError("Selecciona un rango de fechas válido.");
      return;
    }

    setAppliedRange({ from: dateFrom, to: dateTo });
  };

  return (
    <div className="space-y-4" style={{ color: "var(--text)" }}>
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{
          border: "var(--border-w) solid var(--border-rgba)",
          background:
            "linear-gradient(135deg, var(--panel), color-mix(in srgb, var(--panel) 72%, transparent))",
          boxShadow: "var(--glow-shadow)",
        }}
      >
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold" style={{ color: "var(--heading)" }}>
              Trazabilidad entre cuentas
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Sigue el dinero desde ingresos externos, transferencias internas y
              salidas por gastos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[150px_150px_auto] gap-3 items-end">
            <div>
              <label
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--muted)" }}
              >
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="ff-input mt-1 w-full"
              />
            </div>

            <div>
              <label
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--muted)" }}
              >
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="ff-input mt-1 w-full"
              />
            </div>

            <button
              type="button"
              onClick={handleApplyRange}
              disabled={loading || !token}
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{
                border: "1px solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--primary) 16%, var(--panel))",
                color: "var(--text)",
              }}
            >
              {loading ? "Actualizando..." : "Aplicar"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <FlowMetric
            label="Ingresos externos"
            value={summary.total_income}
            tone="success"
            note={summary.top_inflow_account?.account_name || ""}
          />
          <FlowMetric
            label="Gastos externos"
            value={summary.total_expense}
            tone="danger"
            note={summary.top_outflow_account?.account_name || ""}
          />
          <FlowMetric
            label="Transferencias"
            value={summary.transfer_volume}
            tone="warning"
            note={`${summary.transfer_route_count || 0} rutas entre cuentas`}
          />
          <FlowMetric
            label="Balance externo"
            value={summary.net_external}
            tone={Number(summary.net_external || 0) >= 0 ? "success" : "danger"}
            note={`${summary.movement_count || 0} movimientos analizados`}
          />
        </div>

        {insights.length > 0 ? (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              border: "1px solid var(--border-rgba)",
              background: "color-mix(in srgb, var(--bg-2) 48%, transparent)",
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2">
              <div>
                <h4 className="font-semibold" style={{ color: "var(--heading)" }}>
                  Lectura automática del flujo
                </h4>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Estimación temporal: qué dinero entró, por dónde pasó y qué terminó financiando.
                </p>
              </div>
              {analysis.method ? (
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Método: FIFO por cuenta
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {insights.slice(0, 3).map((insight, index) => (
                <div
                  key={`${insight.kind || "insight"}-${index}`}
                  className="rounded-xl px-3 py-3"
                  style={{
                    border: "1px solid var(--border-rgba)",
                    background: "color-mix(in srgb, var(--panel) 68%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                        {insight.title}
                      </p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                        {insight.body}
                      </p>
                    </div>
                    <span
                      className="text-sm font-extrabold shrink-0"
                      style={{ color: "var(--primary)" }}
                    >
                      {money(insight.amount)}
                    </span>
                  </div>
                  {insight.path?.length ? (
                    <p className="text-[11px] mt-2 truncate" style={{ color: "var(--muted)" }}>
                      Ruta: {pathLabel(insight.path)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              border: "1px solid color-mix(in srgb, var(--danger) 45%, var(--border-rgba))",
              background: "color-mix(in srgb, var(--danger) 12%, transparent)",
              color: "var(--text)",
            }}
          >
            {error}
          </div>
        ) : null}

        {loading && !payload ? (
          <p className="text-sm italic" style={{ color: "var(--muted)" }}>
            Construyendo trazabilidad...
          </p>
        ) : (
          <FlowCanvas
            accounts={accounts}
            links={links}
            focusedKey={focusedAccountKey}
            onFocus={setFocusedAccountKey}
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-4">
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            border: "1px solid var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 82%, transparent)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold" style={{ color: "var(--heading)" }}>
                Cuentas del periodo
              </h4>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Click en una cuenta del mapa o filtra aquí.
              </p>
            </div>

            <select
              value={focusedAccountKey}
              onChange={(e) => setFocusedAccountKey(e.target.value)}
              className="ff-input text-sm min-w-44"
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.account_key} value={account.account_key}>
                  {account.account_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {(focusedAccount ? [focusedAccount] : accounts).map((account) => {
              const role = rolesByAccountId[account.account_key];
              const netColor =
                Number(account.net_total || 0) >= 0
                  ? "var(--success)"
                  : "var(--danger)";

              return (
                <button
                  type="button"
                  key={account.account_key}
                  onClick={() =>
                    setFocusedAccountKey(
                      focusedAccountKey === account.account_key
                        ? ""
                        : account.account_key
                    )
                  }
                  className="w-full rounded-xl px-3 py-3 text-left"
                  style={{
                    border:
                      focusedAccountKey === account.account_key
                        ? "1px solid color-mix(in srgb, var(--primary) 70%, var(--border-rgba))"
                        : "1px solid var(--border-rgba)",
                    background:
                      focusedAccountKey === account.account_key
                        ? "color-mix(in srgb, var(--primary) 12%, var(--panel))"
                        : "color-mix(in srgb, var(--panel) 62%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate" style={{ color: "var(--text)" }}>
                        {account.account_name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        Entra {money(account.total_in)} · Sale {money(account.total_out)}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold shrink-0" style={{ color: netColor }}>
                      {money(account.net_total)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span style={{ color: "var(--success)" }}>
                      Ingresos: {money(account.income)}
                    </span>
                    <span style={{ color: "var(--danger)" }}>
                      Gastos: {money(account.expense)}
                    </span>
                    <span style={{ color: "var(--primary)" }}>
                      Transf. entrada: {money(account.transfer_in)}
                    </span>
                    <span style={{ color: "var(--warning)" }}>
                      Transf. salida: {money(account.transfer_out)}
                    </span>
                  </div>
                  {role ? (
                    <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                      Rol: <span style={{ color: "var(--text)", fontWeight: 700 }}>{role.role}</span>{" "}
                      · {role.reason}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 space-y-4"
          style={{
            border: "1px solid var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 82%, transparent)",
          }}
        >
          <div>
            <h4 className="font-semibold" style={{ color: "var(--heading)" }}>
              Rutas de transferencia
            </h4>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Muestra el volumen movido entre cuentas en el rango seleccionado.
            </p>
          </div>

          {links.length === 0 ? (
            <p className="text-sm italic" style={{ color: "var(--muted)" }}>
              No hay transferencias entre cuentas en este periodo.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border-rgba)" }}>
              <table className="min-w-full text-sm">
                <thead
                  style={{
                    background: "color-mix(in srgb, var(--panel) 85%, transparent)",
                    color: "var(--muted)",
                  }}
                >
                  <tr>
                    <th className="px-3 py-2 text-left">Origen</th>
                    <th className="px-3 py-2 text-left">Destino</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-center">Veces</th>
                    <th className="px-3 py-2 text-center">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {links.slice(0, 12).map((link, index) => (
                    <tr
                      key={`${link.from_account_id || "from"}-${link.to_account_id || "to"}-${index}`}
                      style={{
                        borderTop: "1px solid var(--border-rgba)",
                        color: "var(--text)",
                      }}
                    >
                      <td className="px-3 py-2">{link.from_account_name}</td>
                      <td className="px-3 py-2">{link.to_account_name}</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--primary)" }}>
                        {money(link.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">{link.count}</td>
                      <td className="px-3 py-2 text-center" style={{ color: "var(--muted)" }}>
                        {link.last_date || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h4 className="font-semibold" style={{ color: "var(--heading)" }}>
              Rutas estimadas hacia gastos
            </h4>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Qué origen de dinero terminó financiando gastos, según el orden temporal.
            </p>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {spendingTraces.length === 0 ? (
              <p className="text-sm italic" style={{ color: "var(--muted)" }}>
                No hay rutas de gasto estimadas para este periodo.
              </p>
            ) : (
              spendingTraces.slice(0, 10).map((trace, index) => (
                <div
                  key={`${trace.source_label}-${trace.spent_account_name}-${trace.category_name}-${index}`}
                  className="rounded-xl px-3 py-2"
                  style={{
                    border: "1px solid var(--border-rgba)",
                    background: "color-mix(in srgb, var(--panel) 58%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                        {trace.source_label} → {trace.category_name}
                      </p>
                      <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
                        {pathLabel(trace.path)} · gasto desde {trace.spent_account_name}
                      </p>
                    </div>
                    <span
                      className="text-sm font-extrabold shrink-0"
                      style={{ color: "var(--danger)" }}
                    >
                      {money(trace.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountFlowTraceReport;
