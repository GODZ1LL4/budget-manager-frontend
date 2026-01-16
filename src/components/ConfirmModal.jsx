import Modal from "./Modal";

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar acción",
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = false,
  loading = false,
  size = "sm",
  details = null, // opcional: string o JSX
}) {
  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title} size={size}>
      <div className="space-y-4">
        {message && (
          <p className="text-base text-slate-200 leading-relaxed">

            {message}
          </p>
        )}

        {details && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">

            {details}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
        <button
            type="button"
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-semibold rounded-lg
              ${danger ? "bg-rose-500 text-slate-300" : "bg-emerald-500 text-slate-950"}
              hover:brightness-110 active:scale-95 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            onClick={onConfirm}
          >
            {loading ? "Procesando..." : confirmText}
          </button>
          <button
            type="button"
            disabled={loading}
            className="
              px-4 py-2 text-sm font-semibold rounded-lg
              border border-slate-600
              bg-slate-900 text-slate-200
              hover:bg-slate-800 hover:border-slate-500
              active:scale-95 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            onClick={onClose}
          >
            {cancelText}
          </button>

          
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
