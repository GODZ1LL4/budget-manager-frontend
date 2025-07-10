import { useEffect, useState } from "react";
import axios from "axios";

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
      alert("Error al obtener categorías");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/categories`,
        { name, type, stability_type: stabilityType },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setName("");
      fetchCategories();
    } catch (err) {
      alert("Error al crear categoría");
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setStabilityType(cat.stability_type || "variable");
  };

  const handleUpdate = async (id) => {
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
      fetchCategories();
    } catch (err) {
      alert("Error al actualizar categoría");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;

    try {
      await axios.delete(`${api}/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
    } catch (err) {
      alert("Error al eliminar categoría");
    }
  };

  useEffect(() => {
    if (token) fetchCategories();
  }, [token]);

  return (
    <div className="p-4 md:p-6 bg-white rounded shadow-md text-gray-800">
      <h2 className="text-xl md:text-2xl font-bold text-[#e32119] mb-4">
        Categorías
      </h2>

      <form
        onSubmit={handleCreate}
        className="flex flex-col sm:flex-row flex-wrap gap-2 mb-6"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="border border-gray-300 p-2 rounded flex-1 min-w-[120px]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-300 p-2 rounded min-w-[120px]"
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </select>
        <select
          value={stabilityType}
          onChange={(e) => setStabilityType(e.target.value)}
          className="border border-gray-300 p-2 rounded min-w-[120px]"
        >
          <option value="fixed">Fijo</option>
          <option value="variable">Variable</option>
          <option value="occasional">Ocasional</option>
        </select>
        <button
          type="submit"
          className="bg-[#e32119] text-white px-4 py-2 rounded hover:bg-red-700 transition min-w-[100px]"
        >
          Agregar
        </button>
      </form>

      {/* Agregamos scroll horizontal */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 border-collapse text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="p-2 border">Nombre</th>
              <th className="p-2 border">Tipo</th>
              <th className="p-2 border">Estabilidad</th>
              <th className="p-2 border text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50">
                {editId === cat.id ? (
                  <>
                    <td className="p-2 border border-gray-300">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="border border-gray-300 p-1 w-full rounded"
                      />
                    </td>
                    <td className="p-2 border border-gray-300">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="border border-gray-300 p-1 w-full rounded"
                      >
                        <option value="expense">Gasto</option>
                        <option value="income">Ingreso</option>
                      </select>
                    </td>
                    <td className="p-2 border border-gray-300">
                      <select
                        value={stabilityType}
                        onChange={(e) => setStabilityType(e.target.value)}
                        className="border border-gray-300 p-1 w-full rounded"
                      >
                        <option value="fixed">Fijo</option>
                        <option value="variable">Variable</option>
                        <option value="occasional">Ocasional</option>
                      </select>
                    </td>
                    <td className="p-2 border border-gray-300 text-center space-x-2">
                      <button
                        onClick={() => handleUpdate(cat.id)}
                        className="bg-yellow-400 text-black px-2 py-1 rounded text-xs"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="text-gray-500 text-xs"
                      >
                        Cancelar
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2 border border-gray-300">{cat.name}</td>
                    <td className="p-2 border border-gray-300 italic text-gray-600">
                      {cat.type}
                    </td>
                    <td className="p-2 border border-gray-300 italic text-gray-600">
                      {cat.stability_type || "variable"}
                    </td>

                    <td className="p-2 border border-gray-300 text-center space-x-2">
                      <button
                        onClick={() => startEdit(cat)}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Categories;
