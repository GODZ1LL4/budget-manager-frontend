import { useEffect, useState } from "react";
import axios from "axios";

function Accounts({ token }) {
  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [editId, setEditId] = useState(null);
  const [balances, setBalances] = useState({});

  const api = import.meta.env.VITE_API_URL;

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${api}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccounts(res.data.data);
    } catch {
      alert("Error al obtener cuentas");
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await axios.get(`${api}/accounts/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalances(res.data.data);
    } catch {
      console.error("No se pudo cargar balances");
    }
  };

  const reload = () => {
    fetchAccounts();
    fetchBalances();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/accounts`,
        { name },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setName("");
      reload();
    } catch {
      alert("Error al crear cuenta");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await axios.put(
        `${api}/accounts/${id}`,
        { name },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEditId(null);
      setName("");
      reload();
    } catch {
      alert("Error al actualizar cuenta");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    try {
      await axios.delete(`${api}/accounts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      reload();
    } catch {
      alert("Error al eliminar cuenta");
    }
  };

  const startEdit = (acc) => {
    setEditId(acc.id);
    setName(acc.name);
  };

  useEffect(() => {
    if (token) reload();
  }, [token]);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold mb-2 text-[#f6e652]">Cuentas</h2>
      <p className="text-sm text-gray-500 mb-4">
        Gestioná tus cuentas personales o bancarias. El saldo se calcula
        automáticamente a partir de tus transacciones.
      </p>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap gap-2 mb-6 items-end"
      >
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">
            Nombre de la cuenta
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Caja de ahorro"
            className="border border-gray-300 p-2 rounded w-64"
          />
        </div>
        <button
          type="submit"
          className="bg-[#f6e652] text-black font-semibold px-4 py-2 rounded hover:brightness-90 transition"
        >
          Agregar
        </button>
      </form>

      <table className="w-full border border-gray-300 border-collapse text-sm">
        <thead className="bg-gray-100 text-left text-gray-700">
          <tr>
            <th className="p-2 border border-gray-300">Nombre</th>
            <th className="p-2 border border-gray-300">Saldo</th>
            <th className="p-2 border border-gray-300 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc) => (
            <tr key={acc.id} className="hover:bg-gray-50">
              {editId === acc.id ? (
                <>
                  <td className="p-2 border border-gray-300">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="border border-gray-300 p-1 w-full rounded"
                    />
                  </td>
                  <td className="p-2 border border-gray-300 italic text-gray-500">
                    {balances[acc.id]?.toFixed(2) ?? "0.00"}
                  </td>
                  <td className="p-2 border border-gray-300 text-center space-x-2">
                    <button
                      onClick={() => handleUpdate(acc.id)}
                      className="bg-[#f6e652] text-black px-2 py-1 rounded text-xs"
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
                  <td className="p-2 border border-gray-300">{acc.name}</td>
                  <td className="p-2 border border-gray-300 text-gray-600">
                    {balances[acc.id]?.toFixed(2) ?? "0.00"}
                  </td>
                  <td className="p-2 border border-gray-300 text-center space-x-2">
                    <button
                      onClick={() => startEdit(acc)}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
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
  );
}

export default Accounts;
