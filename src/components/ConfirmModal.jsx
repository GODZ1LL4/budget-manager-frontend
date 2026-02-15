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
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      size={size}
    >
      <div className="space-y-4">
        {message && (
          <p className="text-base leading-relaxed text-[var(--text)]">
            {message}
          </p>
        )}

        {details && (
          <div
            className="rounded-[var(--radius-lg)] p-4 text-sm"
            style={{
              border: "var(--border-w) solid var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              color: "var(--text)",
            }}
          >
            {details}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={loading}
            className={`ff-btn ${danger ? "ff-btn-danger" : "ff-btn-primary"}`}
            onClick={onConfirm}
          >
            {loading ? "Procesando..." : confirmText}
          </button>

          <button
            type="button"
            disabled={loading}
            className="ff-btn ff-btn-outline"
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
