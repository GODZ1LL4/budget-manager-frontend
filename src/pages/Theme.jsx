// src/pages/Theme.jsx
import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
import {
  THEME_PRESETS,
  THEME_SECTIONS,
  ALL_THEME_KEYS,
} from "../theme/themeSchema";
import {
  applyTheme,
  clearTheme,
  loadTheme,
  saveTheme,
  makeEmptyTheme,
} from "../theme/themeStore";

function readComputedVar(key) {
  const root = document.documentElement;
  return String(getComputedStyle(root).getPropertyValue(key) || "").trim();
}

function clamp255(n) {
  return Math.max(0, Math.min(255, Number.isFinite(n) ? n : 0));
}

// Para el input type="color" (solo acepta hex)
function normalizeToHexOrFallback(v) {
  const s = String(v || "").trim();

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;

  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const r = clamp255(Number(m[1]));
    const g = clamp255(Number(m[2]));
    const b = clamp255(Number(m[3]));
    return (
      "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
    );
  }

  return "#000000";
}

function stripUnit(v, unit) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (!unit) return s;
  return s.endsWith(unit) ? s.slice(0, -unit.length) : s;
}

function fieldValue(theme, key) {
  return theme?.vars?.[key] ?? "";
}

export default function Theme() {
  const [theme, setTheme] = useState(() => loadTheme() || makeEmptyTheme());
  const [showImport, setShowImport] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // ===== Color-mix helper modal =====
  const [mixOpen, setMixOpen] = useState(false);
  const [mixKey, setMixKey] = useState("");
  const [mixSpace, setMixSpace] = useState("in srgb");
  const [mixA, setMixA] = useState("var(--primary)");
  const [mixAPct, setMixAPct] = useState(55);
  const [mixB, setMixB] = useState("var(--border-rgba)");
  const [mixBPct, setMixBPct] = useState(45);

  const openMixFor = (key) => {
    setMixKey(key);
    // defaults “pro” razonables
    setMixSpace("in srgb");
    setMixA("var(--primary)");
    setMixAPct(55);
    setMixB("var(--border-rgba)");
    setMixBPct(45);
    setMixOpen(true);
  };

  const applyMix = () => {
    const a = String(mixA || "").trim() || "var(--primary)";
    const b = String(mixB || "").trim() || "transparent";
    const ap = Number.isFinite(Number(mixAPct)) ? Number(mixAPct) : 50;
    const bp = Number.isFinite(Number(mixBPct)) ? Number(mixBPct) : 50;

    const expr = `color-mix(${mixSpace}, ${a} ${ap}%, ${b} ${bp}%)`;
    setVar(mixKey, expr);
    setMixOpen(false);
  };

  // Apply live
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Snapshot computed values (what's effectively applied)
  const computedSnapshot = useMemo(() => {
    const out = {};
    for (const k of ALL_THEME_KEYS) out[k] = readComputedVar(k);

    // derived / debug
    out["--border-rgba"] = readComputedVar("--border-rgba");
    out["--glow-shadow"] = readComputedVar("--glow-shadow");
    out["--btn-glow-shadow"] = readComputedVar("--btn-glow-shadow");
    return out;
  }, [theme]);

  const setVar = (key, value) => {
    setTheme((prev) => {
      const next = { ...prev, vars: { ...(prev.vars || {}) } };
      const v = String(value ?? "").trim();
      if (!v) delete next.vars[key];
      else next.vars[key] = v;
      return next;
    });
  };

  const setRangeVar = (key, value, unit) => {
    const raw = String(value ?? "");
    if (raw.trim() === "") return setVar(key, "");
    setVar(key, `${raw}${unit || ""}`);
  };

  const handleSave = () => {
    saveTheme(theme);
    setToast("✅ Tema guardado en este navegador.");
    setError("");
    window.setTimeout(() => setToast(""), 1800);
  };

  const handleReset = () => {
    clearTheme();
    const empty = makeEmptyTheme();
    setTheme(empty);
    applyTheme(empty);
    setToast("🔁 Tema reiniciado.");
    setError("");
    window.setTimeout(() => setToast(""), 1800);
  };

  const handleExport = async () => {
    const txt = JSON.stringify(theme, null, 2);
    setJsonText(txt);
    setShowImport(true);
    setError("");

    try {
      await navigator.clipboard?.writeText(txt);
      setToast("📋 Copiado al portapapeles.");
      window.setTimeout(() => setToast(""), 1800);
    } catch {
      // ok, el JSON queda en el textarea
    }
  };

  const handleOpenImport = () => {
    setJsonText("");
    setShowImport(true);
    setError("");
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonText);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("JSON inválido: no es un objeto.");
      }

      const next = {
        version: 1,
        name: String(parsed.name || "Personalizado"),
        preset: String(parsed.preset || "default"),
        vars: parsed.vars && typeof parsed.vars === "object" ? parsed.vars : {},
      };

      setTheme(next);
      saveTheme(next);
      setShowImport(false);
      setToast("✅ Tema importado y guardado.");
      setError("");
      window.setTimeout(() => setToast(""), 1800);
    } catch (e) {
      setError(e?.message || "Error importando tema");
    }
  };

  // Panels / primitives
  const panelClass =
    "rounded-2xl border border-[var(--border-rgba)] bg-[var(--panel)] text-[var(--text)] shadow-none";
  const textareaClass =
    "w-full rounded-xl bg-[var(--panel-2)] border border-[var(--border-rgba)] text-[var(--text)] p-3 font-mono text-xs outline-none";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Configuración · Tema
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Cambia tokens globales y por componente. Se guarda en localStorage.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="ff-btn ff-btn-primary"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="ff-btn ff-btn-outline"
          >
            Exportar
          </button>
          <button
            type="button"
            onClick={handleOpenImport}
            className="ff-btn ff-btn-outline"
          >
            Importar
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="ff-btn ff-btn-danger"
          >
            Reset
          </button>
        </div>
      </div>

      {toast && (
        <div className="text-sm" style={{ color: "var(--success)" }}>
          {toast}
        </div>
      )}
      {error && (
        <div className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* Preset */}
      <div className={`${panelClass} p-4 relative`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.16em] uppercase text-[var(--muted)]">
              Preset base
            </div>
            <div className="text-sm text-[var(--text)] font-semibold mt-1">
              Base del tema
            </div>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-2xl">
              El preset define los valores iniciales. Tus overrides se aplican
              por encima. Usa “limpiar/reset” en cada campo para volver al
              preset.
            </p>
          </div>

          <div className="hidden sm:block text-[11px] text-[var(--muted)]">
            Persistencia:{" "}
            <span className="text-[var(--text)]">localStorage</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-7">
            <FFSelect
              value={theme.preset || "default"}
              onChange={(v) => setTheme((prev) => ({ ...prev, preset: v }))}
              options={THEME_PRESETS.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              placeholder="Selecciona preset..."
            />
          </div>

          <div className="sm:col-span-5 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setTheme((prev) => ({ ...prev, vars: {} }));
                setToast("🔁 Overrides limpiados (volviste al preset).");
                window.setTimeout(() => setToast(""), 1800);
              }}
              className="ff-btn ff-btn-outline"
            >
              Limpiar overrides
            </button>
          </div>
        </div>
      </div>

      {/* Controls + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-2 space-y-4">
          {THEME_SECTIONS.map((section) => (
            <div key={section.id} className={`${panelClass} p-4`}>
              <div className="mb-3">
                <div className="text-sm font-semibold text-[var(--text)]">
                  {section.title}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {section.description}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map((f) => {
                  const stored = fieldValue(theme, f.key);
                  const computed = computedSnapshot[f.key];

                  // ========= COLOR =========
                  if (f.type === "color") {
                    // Importante: el picker debe mostrar el *computed* (que resuelve var()/color-mix)
                    // mientras el input texto mantiene el stored (override) para expresiones.
                    const pickerHex = normalizeToHexOrFallback(computed || stored);

                    return (
                      <div key={f.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs text-[var(--muted)]">
                            {f.label}
                          </label>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openMixFor(f.key)}
                              className="ff-btn ff-btn-ghost ff-btn-sm"
                              title="Generar color-mix(...)"
                            >
                              mix
                            </button>
                            <button
                              type="button"
                              onClick={() => setVar(f.key, "")}
                              className="ff-btn ff-btn-ghost ff-btn-sm"
                              title="Volver al preset"
                            >
                              limpiar
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={pickerHex}
                            onChange={(e) => setVar(f.key, e.target.value)}
                            className="h-10 w-12 rounded-lg border border-[var(--border-rgba)] bg-transparent"
                            aria-label={`Color ${f.label}`}
                            title="El selector solo genera HEX; para expresiones usa el campo de texto o el botón mix."
                          />
                          <input
                            value={stored}
                            onChange={(e) => setVar(f.key, e.target.value)}
                            placeholder={computed}
                            className="ff-input"
                          />
                        </div>

                        <div className="text-[11px] text-[var(--muted)]">
                          efectivo:{" "}
                          <span className="text-[var(--text)]">{computed}</span>
                        </div>
                      </div>
                    );
                  }

                  // ========= RANGE =========
                  if (f.type === "range") {
                    const unit = f.unit || "";
                    const effective = stored || computed;
                    const numeric = Number(stripUnit(effective, unit)) || 0;

                    return (
                      <div key={f.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs text-[var(--muted)]">
                            {f.label}
                          </label>
                          <button
                            type="button"
                            onClick={() => setVar(f.key, "")}
                            className="ff-btn ff-btn-ghost ff-btn-sm"
                            title="Volver al preset"
                          >
                            reset
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            value={numeric}
                            onChange={(e) =>
                              setRangeVar(f.key, e.target.value, unit)
                            }
                            className="w-full"
                          />
                          <input
                            type="number"
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            value={numeric}
                            onChange={(e) =>
                              setRangeVar(f.key, e.target.value, unit)
                            }
                            className="ff-input w-24"
                          />
                        </div>

                        <div className="text-[11px] text-[var(--muted)]">
                          efectivo:{" "}
                          <span className="text-[var(--text)]">{computed}</span>
                        </div>
                      </div>
                    );
                  }

                  // ========= TEXT (para tokens tipo shadow, etc.) =========
                  if (f.type === "text") {
                    return (
                      <div key={f.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs text-[var(--muted)]">
                            {f.label}
                          </label>
                          <button
                            type="button"
                            onClick={() => setVar(f.key, "")}
                            className="ff-btn ff-btn-ghost ff-btn-sm"
                            title="Volver al preset"
                          >
                            limpiar
                          </button>
                        </div>

                        <input
                          value={stored}
                          onChange={(e) => setVar(f.key, e.target.value)}
                          placeholder={computed}
                          className="ff-input"
                        />

                        <div className="text-[11px] text-[var(--muted)]">
                          efectivo:{" "}
                          <span className="text-[var(--text)]">{computed}</span>
                        </div>
                      </div>
                    );
                  }

                  // ========= DERIVED (solo lectura) =========
                  if (f.type === "derived") {
                    const val = readComputedVar(f.key);
                    return (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">
                          {f.label}
                        </label>
                        <div
                          className="rounded-xl border border-[var(--border-rgba)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text)]"
                          style={{ fontFamily: "ui-monospace, SFMono-Regular" }}
                        >
                          {val || "(vacío)"}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className={`${panelClass} p-4`}>
            <div className="text-sm font-semibold text-[var(--text)] mb-2">
              Preview
            </div>

            <div className="space-y-1">
              <div className="ff-h1">Título principal</div>
              <div className="ff-h2">Sección</div>
              <div className="ff-h3 ff-heading-accent">Título acento</div>
              <div className="ff-heading-muted text-sm">Texto secundario</div>
            </div>

            <div className="space-y-3 mt-3">
              <div className="ff-card p-3">
                <div className="text-xs tracking-[0.16em] uppercase text-[var(--muted)]">
                  Card ejemplo
                </div>
                <div className="text-sm text-[var(--text)]">Texto principal</div>
                <div className="text-xs text-[var(--muted)]">
                  muted / secondary
                </div>
              </div>

              <FFSelect
                value={"a"}
                onChange={() => {}}
                options={[
                  { value: "a", label: "Sin impuesto" },
                  {
                    value: "b",
                    label: "ITBIS 18%",
                    subLabel: "Impuesto estándar",
                  },
                  { value: "c", label: "Exento", subLabel: "No aplica" },
                ]}
              />

              <input className="ff-input" placeholder="Input ejemplo" />

              <div className="flex flex-wrap gap-2">
                <button type="button" className="ff-btn">
                  Default
                </button>
                <button type="button" className="ff-btn ff-btn-outline">
                  Outline
                </button>
                <button type="button" className="ff-btn ff-btn-ghost">
                  Ghost
                </button>
                <button type="button" className="ff-btn ff-btn-primary">
                  Primary
                </button>
                <button type="button" className="ff-btn ff-btn-success">
                  Success
                </button>
                <button type="button" className="ff-btn ff-btn-warning">
                  Warning
                </button>
                <button type="button" className="ff-btn ff-btn-danger">
                  Danger
                </button>
                <button type="button" className="ff-btn ff-btn-primary ff-btn-sm">
                  SM
                </button>
                <button type="button" className="ff-btn ff-btn-primary ff-btn-lg">
                  LG
                </button>
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border-rgba)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)]">
                <div>
                  border:{" "}
                  <span className="text-[var(--text)]">
                    {readComputedVar("--border-rgba")}
                  </span>
                </div>
                <div>
                  glow:{" "}
                  <span className="text-[var(--text)]">
                    {readComputedVar("--glow-shadow")}
                  </span>
                </div>
                <div>
                  btn glow:{" "}
                  <span className="text-[var(--text)]">
                    {readComputedVar("--btn-glow-shadow")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${panelClass} p-4`}>
            <div className="text-xs text-[var(--muted)]">
              Tip: para volver un valor al preset, usa “limpiar/reset”. Si quieres
              valores “pro” (ej: <code>color-mix(...)</code>), escríbelos en el
              input de texto o usa el botón <strong>mix</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* Import/Export modal */}
      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Importar / Exportar tema"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Pega un JSON (importar). Para exportar, usa el botón “Exportar”.
          </p>

          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={12}
            className={textareaClass}
            placeholder={`{\n  "version": 1,\n  "preset": "default",\n  "vars": {\n    "--primary": "#10b981"\n  }\n}`}
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="ff-btn ff-btn-outline"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="ff-btn ff-btn-primary"
            >
              Importar
            </button>
          </div>

          {error && (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
        </div>
      </Modal>

      {/* color-mix helper modal */}
      <Modal
        isOpen={mixOpen}
        onClose={() => setMixOpen(false)}
        title="Generador color-mix(...)"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Esto genera un string CSS tipo{" "}
            <span className="text-[var(--text)]">
              color-mix(in srgb, A 55%, B 45%)
            </span>{" "}
            y lo guarda en el token seleccionado. El picker solo da HEX, pero el
            input de texto acepta expresiones completas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="ff-label">Color A (puede ser var(--token))</label>
              <input
                value={mixA}
                onChange={(e) => setMixA(e.target.value)}
                className="ff-input"
                placeholder="var(--primary) o #ff0000"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Porcentaje A</label>
              <input
                type="number"
                min={0}
                max={100}
                value={mixAPct}
                onChange={(e) => setMixAPct(Number(e.target.value))}
                className="ff-input"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Color B</label>
              <input
                value={mixB}
                onChange={(e) => setMixB(e.target.value)}
                className="ff-input"
                placeholder="var(--border-rgba) o transparent"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Porcentaje B</label>
              <input
                type="number"
                min={0}
                max={100}
                value={mixBPct}
                onChange={(e) => setMixBPct(Number(e.target.value))}
                className="ff-input"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="ff-label">Espacio de color</label>
              <FFSelect
                value={mixSpace}
                onChange={(v) => setMixSpace(v)}
                options={[
                  { value: "in srgb", label: "in srgb (recomendado)" },
                  { value: "in_oklab", label: "in_oklab (mezcla más perceptual)" },
                  { value: "in_hsl", label: "in_hsl (ojo con resultados raros)" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-[var(--muted)]">Resultado</div>
            <div
              className="rounded-xl border border-[var(--border-rgba)] bg-[var(--panel-2)] p-3 text-xs"
              style={{ fontFamily: "ui-monospace, SFMono-Regular" }}
            >
              {`color-mix(${mixSpace}, ${mixA} ${mixAPct}%, ${mixB} ${mixBPct}%)`}
            </div>

            <div
              className="rounded-xl border border-[var(--border-rgba)] p-4"
              style={{
                background: `color-mix(${mixSpace}, ${mixA} ${mixAPct}%, ${mixB} ${mixBPct}%)`,
              }}
              title="Preview"
            />
          </div>

          <div className="flex justify-end gap-2">
          <button type="button" onClick={applyMix} className="ff-btn ff-btn-primary">
              Aplicar
            </button>
            <button
              type="button"
              onClick={() => setMixOpen(false)}
              className="ff-btn ff-btn-outline"
            >
              Cancelar
            </button>
            
          </div>
        </div>
      </Modal>
    </div>
  );
}
