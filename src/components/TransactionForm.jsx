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
    <div className="space-y-4 text-slate-200">
      {/* Nombre */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-300">
          Nombre
        </label>
        <input
          type="text"
          placeholder="Ej: Renta, Luz, Supermercado..."
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="
            w-full rounded-lg px-3 py-2 text-sm
            bg-slate-900 border border-slate-700
            text-slate-100 placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          "
          required
        />
      </div>

      {/* Monto */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-300">
          Monto
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-xs text-slate-400">
            RD$
          </span>
          <input
            type="number"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) =>
              setFormData({
                ...formData,
                amount: Number(e.target.value || 0),
              })
            }
            className="
              w-full rounded-lg pl-10 pr-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          />
        </div>
      </div>

      {/* Tipo */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-300">
          Tipo
        </label>
        <select
          value={formData.type}
          onChange={(e) =>
            setFormData({
              ...formData,
              type: e.target.value,
              category_id: null,
            })
          }
          className="
            w-full rounded-lg px-3 py-2 text-sm
            bg-slate-900 border border-slate-700
            text-slate-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          "
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </select>
      </div>

      {/* Categoría */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-300">
          Categoría
        </label>
        <select
          value={formData.category_id || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              category_id: e.target.value || null,
            })
          }
          className="
            w-full rounded-lg px-3 py-2 text-sm
            bg-slate-900 border border-slate-700
            text-slate-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          "
        >
          <option value="">Sin categoría</option>
          {filteredCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Botones */}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          className="
            px-4 py-2 text-sm font-semibold rounded-lg
            bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
            text-slate-950
            shadow-[0_0_18px_rgba(16,185,129,0.7)]
            hover:brightness-110
            active:scale-95
            transition-all
          "
        >
          {isEditing ? "Actualizar" : "Guardar"}
        </button>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="
              px-4 py-2 text-sm font-semibold rounded-lg
              bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400
              text-white
              shadow-[0_0_14px_rgba(248,113,113,0.45)]
              hover:brightness-110
              active:scale-95
              transition-all
            "
          >
            Eliminar
          </button>
        )}

        <button
          type="button"
          className="
            px-4 py-2 text-sm font-semibold rounded-lg
            border border-slate-600
            bg-slate-900 text-slate-300
            hover:bg-slate-800 hover:border-slate-500
            active:scale-95
            transition-all
          "
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default TransactionForm;
