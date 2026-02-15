import FFSelect from "../components/FFSelect"; // ajusta la ruta si aplica

function TransactionForm({
  formData,
  setFormData,
  categories,
  onCancel,
  onSave,
  onDelete,
  isEditing = false,
}) {
  const filteredCategories = (categories || []).filter(
    (cat) => cat.type === formData.type
  );

  return (
    <div className="space-y-4" style={{ color: "var(--text)" }}>
      {/* Nombre */}
      <div className="space-y-1">
        <label className="ff-label">Nombre</label>
        <input
          type="text"
          placeholder="Ej: Renta, Luz, Supermercado..."
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="ff-input"
          required
        />
      </div>

      {/* Monto */}
      <div className="space-y-1">
        <label className="ff-label">Monto</label>
        <div className="relative">
          <span
            className="absolute inset-y-0 left-3 flex items-center text-xs"
            style={{ color: "var(--muted)" }}
          >
            RD$
          </span>

          <input
            type="number"
            placeholder="0.00"
            value={formData.amount}
            min={0}
            step="0.01"
            onChange={(e) => {
              const v = Number(e.target.value);
              setFormData({
                ...formData,
                amount: Number.isNaN(v) ? 0 : Math.max(0, v),
              });
            }}
            className="ff-input"
            style={{ paddingLeft: "3.25rem" }} // espacio real para "RD$"
            required
          />
        </div>
      </div>

      {/* Tipo (FFSelect) */}
      <div className="space-y-1">
        <label className="ff-label">Tipo</label>
        <FFSelect
          value={formData.type}
          onChange={(v) =>
            setFormData({
              ...formData,
              type: v,
              category_id: null,
            })
          }
          options={[
            { value: "expense", label: "Gasto" },
            { value: "income", label: "Ingreso" },
          ]}
          clearable={false}
        />
      </div>

      {/* Categoría (FFSelect) */}
      <div className="space-y-1">
        <label className="ff-label">Categoría</label>
        <FFSelect
          value={formData.category_id || ""}
          onChange={(v) =>
            setFormData({
              ...formData,
              category_id: v ? v : null,
            })
          }
          options={[{ id: "", name: "Sin categoría" }, ...filteredCategories]}
          getOptionValue={(cat) => cat.id}
          getOptionLabel={(cat) => cat.name}
          clearable={false}
        />
      </div>

      {/* Botones */}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          className="ff-btn ff-btn-primary"
        >
          {isEditing ? "Actualizar" : "Guardar"}
        </button>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ff-btn ff-btn-danger"
          >
            Eliminar
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="ff-btn ff-btn-outline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default TransactionForm;
