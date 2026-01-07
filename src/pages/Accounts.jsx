import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";

// 🔔 react-toastify
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Accounts({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [editId, setEditId] = useState(null);

  // balances map: { [accountId]: { current, reserved, available } }
  const [balances, setBalances] = useState({});

  const [showTransfer, setShowTransfer] = useState(false);
  const [tFrom, setTFrom] = useState("");
  const [tFromName, setTFromName] = useState("");
  const [tTo, setTTo] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tDate, setTDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tDesc, setTDesc] = useState("");
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState("");

  // Estados para el modal de eliminar
  const [showDelete, setShowDelete] = useState(false);
  const [deleteAcc, setDeleteAcc] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openDelete = (acc) => {
    setDeleteAcc(acc);
    setShowDelete(true);
  };

  const closeDelete = () => {
    if (!deleteLoading) {
      setShowDelete(false);
      setDeleteAcc(null);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${api}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccounts(res.data.data || []);
    } catch {
      toast.error("Error al obtener cuentas");
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await axios.get(`${api}/accounts/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // res.data.data = array [{id, name, current_balance, reserved_total, available_balance}, ...]
      const map = {};
      for (const a of res.data.data || []) {
        map[a.id] = {
          current: Number(a.current_balance ?? 0),
          reserved: Number(a.reserved_total ?? 0),
          available: Number(a.available_balance ?? 0),
        };
      }
      setBalances(map);
    } catch (err) {
      console.error("No se pudo cargar balances", err);
      toast.error("Error al cargar saldos");
    }
  };

  const reload = async () => {
    await Promise.all([fetchAccounts(), fetchBalances()]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre de la cuenta es obligatorio");
      return;
    }

    try {
      await axios.post(
        `${api}/accounts`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setName("");
      await reload();
      toast.success("Cuenta creada correctamente");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al crear cuenta");
    }
  };

  const handleUpdate = async (id) => {
    if (!name.trim()) {
      toast.error("El nombre de la cuenta es obligatorio");
      return;
    }

    try {
      await axios.put(
        `${api}/accounts/${id}`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditId(null);
      setName("");
      await reload();
      toast.success("Cuenta actualizada");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al actualizar cuenta");
    }
  };

  const confirmDelete = async () => {
    if (!deleteAcc) return;
    setDeleteLoading(true);

    try {
      await axios.delete(`${api}/accounts/${deleteAcc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await reload();
      toast.success(`Cuenta "${deleteAcc.name}" eliminada`);
      closeDelete();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al eliminar cuenta");
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEdit = (acc) => {
    setEditId(acc.id);
    setName(acc.name);
  };

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitTransfer = async (e) => {
    e.preventDefault();
    setTError("");

    if (!tFrom || !tTo || !tDate || tAmount === "") {
      toast.error("Completa todos los campos.");
      return;
    }

    const amountNum = Number(tAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Monto inválido.");
      return;
    }

    if (tFrom === tTo) {
      toast.error("Las cuentas deben ser distintas.");
      return;
    }

    // ✅ Decide regla: para transferir, valida contra saldo REAL (current)
    // Si quieres validar contra disponible (por metas), cambia a `.available`
    const fromBalance = balances[tFrom]?.current ?? 0;

    if (fromBalance < amountNum) {
      toast.error("Saldo insuficiente en la cuenta origen.");
      return;
    }

    try {
      setTLoading(true);

      await axios.post(
        `${api}/accounts/transfer`,
        {
          from_account_id: tFrom,
          to_account_id: tTo,
          amount: amountNum,
          date: tDate,
          description: tDesc || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const toName = accounts.find((a) => a.id === tTo)?.name || "cuenta destino";
      toast.success(
        `Transferencia realizada: ${amountNum.toFixed(2)} DOP de ${tFromName} a ${toName}`
      );

      setShowTransfer(false);
      setTFrom("");
      setTTo("");
      setTAmount("");
      setTDesc("");
      await reload();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error || "No se pudo realizar la transferencia.";
      setTError(msg);
      toast.error(msg);
    } finally {
      setTLoading(false);
    }
  };

  const fmt = (n) => Number(n ?? 0).toFixed(2);

  return (
    <div
      className="
        rounded-2xl p-6
        bg-slate-950/70
        border border-slate-800
        shadow-[0_18px_40px_rgba(0,0,0,0.7)]
        text-slate-100
        space-y-4
      "
    >
      <ToastContainer position="top-right" autoClose={2500} />

      <h2 className="text-2xl font-bold mb-1 text-[#f6e652]">Cuentas</h2>
      <p className="text-sm text-slate-400 mb-4">
        Gestioná tus cuentas. El saldo se calcula automáticamente a partir de tus transacciones.
        Las metas reservan fondos y afectan el disponible.
      </p>

      {/* Formulario crear / editar nombre */}
      <form onSubmit={handleCreate} className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-slate-300">Nombre de la cuenta</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Caja de ahorro"
            className="
              border border-slate-700 bg-slate-900
              text-slate-100 placeholder:text-slate-500
              px-3 py-2 rounded-lg w-64 text-sm
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition
            "
          />
        </div>

        <button
          type="submit"
          className="
            bg-[#f6e652] text-black font-semibold
            px-4 py-2 rounded-lg text-sm
            hover:brightness-95 active:scale-95
            transition
          "
        >
          Agregar
        </button>
      </form>

      {/* Tabla de cuentas */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-300">
            <tr>
              <th className="p-2 border-b border-slate-800">Nombre</th>
              <th className="p-2 border-b border-slate-800">Saldo</th>
              <th className="p-2 border-b border-slate-800 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((acc, rowIdx) => {
              const bal = balances[acc.id] || { current: 0, reserved: 0, available: 0 };

              return (
                <tr
                  key={acc.id}
                  className={
                    rowIdx % 2 === 0
                      ? "bg-slate-950/40 hover:bg-slate-900/80"
                      : "bg-slate-900/60 hover:bg-slate-900"
                  }
                >
                  {editId === acc.id ? (
                    <>
                      <td className="p-2 border-t border-slate-800 align-middle">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="
                            border border-slate-700 bg-slate-900
                            text-slate-100 px-2 py-1 text-sm rounded-lg
                            w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                          "
                        />
                      </td>

                      <td className="p-2 border-t border-slate-800">
                        <div className="text-xl text-slate-100">{fmt(bal.current)} DOP</div>
                        <div className="text-xs text-slate-300">
                          Reservado: {fmt(bal.reserved)} • Disponible: {fmt(bal.available)}
                        </div>
                      </td>

                      <td className="p-2 border-t border-slate-800">
                        <div className="flex justify-center flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(acc.id)}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md
                              bg-emerald-600 text-white hover:brightness-110
                              focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-950
                              transition
                            "
                          >
                            Guardar
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditId(null);
                              setName("");
                            }}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md
                              bg-slate-800 text-slate-200 border border-slate-600
                              hover:bg-slate-700
                              focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 focus:ring-offset-slate-950
                              transition
                            "
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 border-t border-slate-800 text-slate-100">{acc.name}</td>

                      <td className="p-2 border-t border-slate-800">
                        <div className="text-ms text-slate-100">{fmt(bal.current)} DOP</div>
                        <div className="text-xs text-slate-300">
                          Reservado: {fmt(bal.reserved)} • Disponible: {fmt(bal.available)}
                        </div>
                      </td>

                      <td className="p-2 border-t border-slate-800">
                        <div className="flex justify-center flex-wrap gap-2">
                          {/* Transferir (azul) */}
                          <button
                            onClick={() => {
                              setTFrom(acc.id);
                              setTFromName(acc.name);
                              setTTo("");
                              setTAmount("");
                              setTDate(new Date().toISOString().split("T")[0]);
                              setTDesc("");
                              setTError("");
                              setShowTransfer(true);
                            }}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md
                              bg-indigo-600 text-white hover:brightness-110
                              focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-slate-950
                              transition
                            "
                            type="button"
                          >
                            Transferir
                          </button>

                          {/* Editar (ámbar) */}
                          <button
                            onClick={() => startEdit(acc)}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md
                              bg-amber-400 text-black hover:brightness-110
                              focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 focus:ring-offset-slate-950
                              transition
                            "
                            type="button"
                          >
                            Editar
                          </button>

                          {/* Eliminar (rojo) */}
                          <button
                            onClick={() => openDelete(acc)}
                            className="
                              inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md
                              bg-rose-600 text-white hover:brightness-110
                              focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 focus:ring-offset-slate-950
                              transition
                            "
                            type="button"
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

      {/* Modal Transferencia */}
      <Modal
        isOpen={showTransfer}
        onClose={() => !tLoading && setShowTransfer(false)}
        title={`Transferir desde ${tFromName}`}
      >
        <form onSubmit={submitTransfer} className="space-y-4 text-slate-200">
          {tError && (
            <div
              className="
                text-sm rounded-lg px-3 py-2
                bg-rose-950/40 border border-rose-700/80
                text-rose-200
              "
            >
              {tError}
            </div>
          )}

          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-300">Hacia</label>
            <select
              value={tTo}
              onChange={(e) => setTTo(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              disabled={tLoading}
              required
            >
              <option value="">Selecciona una cuenta</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} disabled={acc.id === tFrom}>
                  {acc.name} {acc.id === tFrom ? "(misma cuenta)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-300">Monto</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={tAmount}
              onChange={(e) => setTAmount(e.target.value)}
              onBlur={() => {
                if (tAmount !== "" && !Number.isNaN(Number(tAmount))) {
                  setTAmount(Number(tAmount).toFixed(2));
                }
              }}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              disabled={tLoading}
              required
            />

            <p className="text-sm text-slate-300 mt-1">
              Saldo real:{" "}
              <span className="font-medium text-slate-200">
                {fmt(balances[tFrom]?.current)}
              </span>{" "}
              • Disponible:{" "}
              <span className="font-medium text-slate-200">
                {fmt(balances[tFrom]?.available)}
              </span>
            </p>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-300">Fecha</label>
            <input
              type="date"
              value={tDate}
              onChange={(e) => setTDate(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              disabled={tLoading}
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              disabled={tLoading}
              placeholder="Ej: mover a ahorro"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="
                px-4 py-2 text-sm font-semibold rounded-lg
                bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
                text-slate-950
                shadow-[0_0_18px_rgba(16,185,129,0.7)]
                hover:brightness-110
                active:scale-95
                transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
              "
              disabled={tLoading}
            >
              {tLoading ? "Transfiriendo..." : "Confirmar transferencia"}
            </button>

            <button
              type="button"
              onClick={() => setShowTransfer(false)}
              className="
                px-4 py-2 text-sm font-semibold rounded-lg
                border border-slate-600
                bg-slate-900
                text-slate-300
                hover:bg-slate-800 hover:border-slate-500
                active:scale-95
                transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              disabled={tLoading}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal eliminar cuenta */}
      <Modal isOpen={showDelete} onClose={closeDelete} title="Eliminar cuenta">
        {(() => {
          const bal = deleteAcc ? balances[deleteAcc.id] : null;
          const current = Number(bal?.current ?? 0);
          const hasBalance = Math.abs(current) > 0.000001;

          return (
            <div className="space-y-4 text-slate-200">
              <div className="text-sm">
                <p>
                  ¿Seguro que deseas eliminar la cuenta{" "}
                  <strong className="text-slate-50">{deleteAcc?.name}</strong>?
                </p>
                <p className="text-xs text-slate-500 mt-1">Esta acción no se puede deshacer.</p>

                {hasBalance && (
                  <div
                    className="
                      mt-3 text-xs
                      rounded-lg px-3 py-2
                      bg-amber-950/40 border border-amber-700/70
                      text-amber-200
                    "
                  >
                    La cuenta tiene un saldo real de <strong>{fmt(current)}</strong>. Te recomiendo
                    transferir o ajustar el saldo antes de eliminarla.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className={`
                    px-4 py-2 text-sm font-semibold rounded-lg
                    text-white transition-all
                    ${
                      hasBalance
                        ? "bg-slate-700 cursor-not-allowed opacity-70"
                        : "bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_14px_rgba(248,113,113,0.45)] hover:brightness-110 active:scale-95"
                    }
                  `}
                  disabled={deleteLoading || hasBalance}
                >
                  {deleteLoading ? "Eliminando..." : "Eliminar"}
                </button>

                <button
                  type="button"
                  onClick={closeDelete}
                  className="
                    px-4 py-2 text-sm font-semibold rounded-lg
                    border border-slate-600 bg-slate-900 text-slate-300
                    hover:bg-slate-800 hover:border-slate-500
                    active:scale-95 transition-all
                  "
                  disabled={deleteLoading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

export default Accounts;
