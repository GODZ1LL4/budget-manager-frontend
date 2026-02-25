import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

function Modal({ isOpen, onClose, title, children, size = "md" }) {
  const sizeClass =
    size === "sm"
      ? "max-w-sm"
      : size === "md"
      ? "max-w-md"
      : size === "lg"
      ? "max-w-3xl"
      : size === "xl"
      ? "max-w-5xl"
      : size === "full"
      ? "max-w-6xl"
      : "max-w-md";

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Overlay tokenizable */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 backdrop-blur-sm"
            style={{
              background:
                "color-mix(in srgb, #000 62%, transparent)", // default overlay
              // Si quieres tokenizarlo luego:
              // background: "var(--modal-overlay, color-mix(in srgb, #000 62%, transparent))",
            }}
          />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-2"
            >
              <Dialog.Panel
                className={`
                  relative w-full ${sizeClass}
                  overflow-hidden
                  rounded-[var(--radius-lg)]
                  text-left align-middle
                  transition-all
                `}
                style={{
                  /* ✅ 100% controlado por tokens */
                  background: "var(--modal-panel)",
                  border: "var(--border-w) solid var(--modal-border)",

                  /* ✅ Shadow premium (profundo + limpio) */
                  boxShadow:
                    "0 30px 90px rgba(0,0,0,0.65), 0 10px 30px rgba(0,0,0,0.35)",
                }}
              >
                {/* Sheen superior (acabado “glass/metal”) */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 22%, transparent 55%)",
                    opacity: 0.85,
                  }}
                />

                {/* Vignette sutil para “profundidad” */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(1200px 500px at 50% 0%, transparent 0%, rgba(0,0,0,0.22) 62%, rgba(0,0,0,0.35) 100%)",
                    opacity: 0.55,
                    mixBlendMode: "multiply",
                  }}
                />

                {/* Inner hairline (borde interior premium) */}
                <div
                  className="pointer-events-none absolute inset-[1px] rounded-[calc(var(--radius-lg)-1px)]"
                  style={{
                    border: "1px solid",
                    borderColor:
                      "color-mix(in srgb, var(--modal-border) 38%, transparent)",
                  }}
                />

                {/* Glow muy sutil (tokenizado) */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)]"
                  style={{
                    boxShadow: "var(--glow-shadow)",
                    opacity: 0.12,
                  }}
                />

                {/* Content */}
                <div className="relative p-6">
                  {title && (
                    <Dialog.Title
                      className="text-lg sm:text-xl font-semibold mb-4"
                      style={{ color: "var(--heading)" }}
                    >
                      {title}
                    </Dialog.Title>
                  )}

                  <div className="text-base" style={{ color: "var(--text)" }}>
                    {children}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default Modal;