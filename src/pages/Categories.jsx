import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

import FFSelect from "../components/FFSelect";

function Categories({ token }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [categories, setCategories] = useState([]);
  const [editId, setEditId] = useState(null);
  const [stabilityType, setStabilityType] = useState("variable");

  const api = import.meta.env.VITE_API_URL;

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${api}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data.data);
    } catch {
      toast.error("Error al obtener categorías");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    try {
      await axios.post(
        `${api}/categories`,
        { name, type, stability_type: stabilityType },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setName("");
      setType("expense");
      setStabilityType("variable");
      fetchCategories();
      toast.success("Categoría creada correctamente");
    } catch {
      toast.error("Error al crear categoría");
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setStabilityType(cat.stability_type || "variable");
  };

  const handleUpdate = async (id) => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    try {
      await axios.put(
        `${api}/categories/${id}`,
        { name, type, stability_type: stabilityType },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEditId(null);
      setName("");
      setType("expense");
      setStabilityType("variable");
      fetchCategories();
      toast.success("Categoría actualizada");
    } catch {
      toast.error("Error al actualizar categoría");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;

    try {
      await axios.delete(`${api}/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
      toast.success("Categoría eliminada");
    } catch {
      toast.error("Error al eliminar categoría");
    }
  };

  useEffect(() => {
    if (token) fetchCategories();
  }, [token]);

  const typeOptions = useMemo(
    () => [
      { value: "expense", label: "Gasto" },
      { value: "income", label: "Ingreso" },
    ],
    []
  );

  const stabilityOptions = useMemo(
    () => [
      { value: "fixed", label: "Fijo" },
      { value: "variable", label: "Variable" },
      { value: "occasional", label: "Ocasional" },
    ],
    []
  );

  return (
    <div className="ff-card p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold mb-2 text-[var(--heading-accent)]">
        Categorías
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Define cómo se clasifican tus ingresos y gastos, y marca su tipo de
        estabilidad para mejores análisis.
      </p>

      {/* FORMULARIO */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6"
      >
        <div className="flex-1 min-w-[140px] flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Supermercado, Alquiler..."
            className="ff-input"
          />
        </div>

        <div className="min-w-[140px] flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
            Tipo
          </label>
          <FFSelect
            value={type}
            onChange={(v) => setType(v)}
            options={typeOptions}
            searchable={false}
            clearable={false}
          />
        </div>

        <div className="min-w-[160px] flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
            Estabilidad
          </label>
          <FFSelect
            value={stabilityType}
            onChange={(v) => setStabilityType(v)}
            options={stabilityOptions}
            searchable={false}
            clearable={false}
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="ff-btn ff-btn-primary min-w-[120px] w-full sm:w-auto"
          >
            Agregar
          </button>
        </div>
      </form>

      {/* TABLA */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{
          border: "var(--border-w) solid var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 55%, transparent)",
          boxShadow: "var(--glow-shadow)",
        }}
      >
        <table className="ff-table min-w-full text-sm">
          <thead>
            <tr>
              <th className="ff-th">Nombre</th>
              <th className="ff-th">Tipo</th>
              <th className="ff-th">Estabilidad</th>
              <th className="ff-th" style={{ textAlign: "center" }}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {categories.map((cat, idx) => (
              <tr key={cat.id} className="ff-tr">
                {editId === cat.id ? (
                  <>
                    <td className="ff-td">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="ff-input"
                      />
                    </td>

                    <td className="ff-td">
                      <FFSelect
                        value={type}
                        onChange={(v) => setType(v)}
                        options={typeOptions}
                        searchable={false}
                        clearable={false}
                      />
                    </td>

                    <td className="ff-td">
                      <FFSelect
                        value={stabilityType}
                        onChange={(v) => setStabilityType(v)}
                        options={stabilityOptions}
                        searchable={false}
                        clearable={false}
                      />
                    </td>

                    <td className="ff-td">
                      <div className="flex justify-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleUpdate(cat.id)}
                          className="ff-btn ff-btn-success ff-btn-sm"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(null);
                            setName("");
                            setType("expense");
                            setStabilityType("variable");
                          }}
                          className="ff-btn ff-btn-ghost ff-btn-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="ff-td">{cat.name}</td>

                    <td className="ff-td text-xs italic text-[var(--muted)]">
                      {cat.type === "income" ? "Ingreso" : "Gasto"}
                    </td>

                    <td className="ff-td text-xs italic text-[var(--muted)]">
                      {cat.stability_type || "variable"}
                    </td>

                    <td className="ff-td">
                      <div className="flex justify-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          className="ff-btn ff-btn-outline ff-btn-sm"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id)}
                          className="ff-btn ff-btn-danger ff-btn-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {categories.length === 0 && (
          <div className="p-4 text-sm text-[var(--muted)]">
            No hay categorías todavía.
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;
