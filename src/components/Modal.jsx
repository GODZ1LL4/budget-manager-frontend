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
        {/* Overlay */}
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
                  transform overflow-hidden rounded-2xl
                  bg-slate-950/95
                  border border-slate-700/80
                  text-left align-middle
                  shadow-[0_18px_60px_rgba(0,0,0,0.9)]
                  transition-all
                `}
              >
                {/* Borde interior sutil */}
                <div className="relative p-6">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/5" />

                  {/* Título */}
                  {title && (
                    <Dialog.Title className="relative text-lg sm:text-xl font-semibold text-slate-100 mb-4">

                      {title}
                    </Dialog.Title>
                  )}

                  {/* Contenido */}
                  <div className="relative text-base text-slate-200">{children}</div>

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
