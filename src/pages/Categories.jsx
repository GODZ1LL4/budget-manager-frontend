import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      toast.error("Error al eliminar categoría");
    }
  };

  useEffect(() => {
    if (token) fetchCategories();
  }, [token]);

  return (
    <div
      className="
        p-4 md:p-6
        rounded-2xl
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900
        border border-slate-800
        shadow-[0_18px_45px_rgba(0,0,0,0.85)]
        text-slate-200
      "
    >
      <h2 className="text-xl md:text-2xl font-bold mb-2 text-[#f6e652]">
        Categorías
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Define cómo se clasifican tus ingresos y gastos, y marca su tipo de
        estabilidad para mejores análisis.
      </p>

      {/* FORMULARIO */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6"
      >
        <div className="flex-1 min-w-[140px] flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Supermercado, Alquiler..."
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          />
        </div>

        <div className="min-w-[140px] flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            Tipo
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>

        <div className="min-w-[160px] flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            Estabilidad
          </label>
          <select
            value={stabilityType}
            onChange={(e) => setStabilityType(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          >
            <option value="fixed">Fijo</option>
            <option value="variable">Variable</option>
            <option value="occasional">Ocasional</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="
              px-4 py-2 text-sm font-semibold rounded-lg
              bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
              text-slate-950
              shadow-[0_0_16px_rgba(16,185,129,0.7)]
              hover:brightness-110 active:scale-95
              transition-all
              min-w-[120px]
            "
          >
            Agregar
          </button>
        </div>
      </form>

      {/* TABLA */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr>
              <th className="p-2 border-r border-slate-800 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Nombre
              </th>
              <th className="p-2 border-r border-slate-800 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Tipo
              </th>
              <th className="p-2 border-r border-slate-800 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Estabilidad
              </th>
              <th className="p-2 text-center text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => {
              const rowBg =
                idx % 2 === 0
                  ? "bg-slate-950/40 hover:bg-slate-900/80"
                  : "bg-slate-900/70 hover:bg-slate-900";

              return (
                <tr
                  key={cat.id}
                  className={`${rowBg} border-t border-slate-800`}
                >
                  {editId === cat.id ? (
                    <>
                      <td className="p-2 border-r border-slate-800">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="
                            border border-slate-700 rounded-lg px-2 py-1 text-sm
                            w-full bg-slate-950 text-slate-100
                            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                          "
                        />
                      </td>
                      <td className="p-2 border-r border-slate-800">
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="
                            border border-slate-700 rounded-lg px-2 py-1 text-sm
                            w-full bg-slate-950 text-slate-100
                            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                          "
                        >
                          <option value="expense">Gasto</option>
                          <option value="income">Ingreso</option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-800">
                        <select
                          value={stabilityType}
                          onChange={(e) => setStabilityType(e.target.value)}
                          className="
                            border border-slate-700 rounded-lg px-2 py-1 text-sm
                            w-full bg-slate-950 text-slate-100
                            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                          "
                        >
                          <option value="fixed">Fijo</option>
                          <option value="variable">Variable</option>
                          <option value="occasional">Ocasional</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleUpdate(cat.id)}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg
                              bg-emerald-500 text-slate-950
                              hover:brightness-110 active:scale-95
                              transition-all
                            "
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => {
                              setEditId(null);
                              setName("");
                              setType("expense");
                              setStabilityType("variable");
                            }}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg
                              bg-slate-800 text-slate-200
                              hover:bg-slate-700 active:scale-95
                              transition-all
                            "
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 border-r border-slate-800 text-slate-100">
                        {cat.name}
                      </td>
                      <td className="p-2 border-r border-slate-800 italic text-xs text-slate-400">
                        {cat.type === "income" ? "Ingreso" : "Gasto"}
                      </td>
                      <td className="p-2 border-r border-slate-800 italic text-xs text-slate-400">
                        {cat.stability_type || "variable"}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => startEdit(cat)}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg
                              bg-sky-500 text-slate-950
                              hover:brightness-110 active:scale-95
                              transition-all
                            "
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg
                              bg-rose-600 text-white
                              hover:brightness-110 active:scale-95
                              transition-all
                            "
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Categories;
