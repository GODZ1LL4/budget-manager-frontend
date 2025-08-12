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
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Nombre"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="border p-2 rounded w-full"
        required
      />

      <input
        type="number"
        placeholder="Monto"
        value={formData.amount}
        onChange={(e) =>
          setFormData({ ...formData, amount: Number(e.target.value) })
        }
        className="border p-2 rounded w-full"
        required
      />

      <select
        value={formData.type}
        onChange={(e) =>
          setFormData({
            ...formData,
            type: e.target.value,
            category_id: null,
          })
        }
        className="border p-2 rounded w-full"
      >
        <option value="expense">Gasto</option>
        <option value="income">Ingreso</option>
      </select>

      <select
        value={formData.category_id || ""}
        onChange={(e) =>
          setFormData({
            ...formData,
            category_id: e.target.value || null,
          })
        }
        className="border p-2 rounded w-full"
      >
        <option value="">Sin categoría</option>
        {filteredCategories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSave}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded"
        >
          {isEditing ? "Actualizar" : "Guardar"}
        </button>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded"
          >
            Eliminar
          </button>
        )}

        <button
          type="button"
          className="px-4 py-2 text-sm bg-gray-200 rounded"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default TransactionForm;
