import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

function Modal({ isOpen, onClose, title, children, size = "md" }) {
  // Soporte para varios tamaños
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
        {/* Overlay (podemos tokenizar luego si quieres) */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
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
                  w-full ${sizeClass}
                  transform overflow-hidden
                  rounded-[var(--radius-lg)]
                  bg-[color-mix(in srgb,var(--panel)_92%,transparent)]
                  border
                  transition-all
                  text-left align-middle
                  shadow-[0_18px_60px_rgba(0,0,0,0.65)]
                `}
                style={{
                  borderWidth: "var(--border-w)",
                  borderColor: "var(--border-rgba)",
                }}
              >
                {/* Borde interior sutil (tokenizado) */}
                <div className="relative p-6">
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)]"
                    style={{
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: "color-mix(in srgb, var(--border-rgba) 22%, transparent)",
                    }}
                  />

                  {/* Título */}
                  {title && (
                    <Dialog.Title className="relative text-lg sm:text-xl font-semibold text-[var(--text)] mb-4">
                      {title}
                    </Dialog.Title>
                  )}

                  {/* Contenido */}
                  <div className="relative text-base text-[var(--text)]">
                    {children}
                  </div>

                  {/* Footer sombra glow (opcional): añade “aura” suave al modal */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)]"
                    style={{
                      boxShadow: "var(--glow-shadow)",
                      opacity: 0.18,
                    }}
                  />
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
