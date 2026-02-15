import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";

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
  const [tDate, setTDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
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

    // valida contra saldo REAL (current)
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

      const toName =
        accounts.find((a) => a.id === tTo)?.name || "cuenta destino";
      toast.success(
        `Transferencia realizada: ${amountNum.toFixed(
          2
        )} DOP de ${tFromName} a ${toName}`
      );

      setShowTransfer(false);
      setTFrom("");
      setTTo("");
      setTAmount("");
      setTDesc("");
      await reload();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.error || "No se pudo realizar la transferencia.";
      setTError(msg);
      toast.error(msg);
    } finally {
      setTLoading(false);
    }
  };

  const fmt = (n) => Number(n ?? 0).toFixed(2);

  const transferOptions = useMemo(() => {
    return accounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
      disabled: String(acc.id) === String(tFrom),
      subLabel: String(acc.id) === String(tFrom) ? "Misma cuenta" : "",
    }));
  }, [accounts, tFrom]);

  return (
    <div className="ff-card p-6 space-y-4">
      <ToastContainer position="top-right" autoClose={2500} />

      <h2 className="ff-h1 ff-heading-accent mb-2">Cuentas</h2>

      <p className="ff-heading-muted text-sm mb-4">
        Gestioná tus cuentas. El saldo se calcula automáticamente…
      </p>

      {/* Formulario crear / editar nombre */}
      <form
        onSubmit={handleCreate}
        className="flex flex-wrap gap-3 mb-6 items-end"
      >
        <div className="flex flex-col">
          <label className="ff-label">Nombre de la cuenta</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Caja de ahorro"
            className="ff-input w-64"
          />
        </div>

        <button type="submit" className="ff-btn ff-btn-primary">
          Agregar
        </button>
      </form>

      {/* Tabla de cuentas */}
      <div className="overflow-hidden">
        <table className="ff-table text-sm">
          <thead>
            <tr>
              <th className="ff-th">Nombre</th>
              <th className="ff-th">Saldo</th>
              <th className="ff-th text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((acc) => {
              const bal = balances[acc.id] || {
                current: 0,
                reserved: 0,
                available: 0,
              };

              return (
                <tr key={acc.id} className="ff-tr">
                  {editId === acc.id ? (
                    <>
                      <td className="ff-td align-middle">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="ff-input"
                        />
                      </td>

                      <td className="ff-td">
                        <div className="text-xl">{fmt(bal.current)} DOP</div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          Reservado: {fmt(bal.reserved)} • Disponible:{" "}
                          {fmt(bal.available)}
                        </div>
                      </td>

                      <td className="ff-td">
                        <div className="flex justify-center flex-wrap gap-2">
                          {/* Guardar: lo dejo Primary porque no pediste cambiarlo */}
                          <button
                            type="button"
                            onClick={() => handleUpdate(acc.id)}
                            className="ff-btn ff-btn-primary"
                          >
                            Guardar
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditId(null);
                              setName("");
                            }}
                            className="ff-btn ff-btn-outline"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="ff-td">{acc.name}</td>

                      <td className="ff-td">
                        <div className="text-ms">{fmt(bal.current)} DOP</div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          Reservado: {fmt(bal.reserved)} • Disponible:{" "}
                          {fmt(bal.available)}
                        </div>
                      </td>

                      <td className="ff-td">
                        <div className="flex justify-center flex-wrap gap-2">
                          {/* Transferir -> Primary */}
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
                            className="ff-btn ff-btn-primary"
                            type="button"
                          >
                            Transferir
                          </button>

                          {/* Editar -> Warning */}
                          <button
                            onClick={() => startEdit(acc)}
                            className="ff-btn ff-btn-warning"
                            type="button"
                          >
                            Editar
                          </button>

                          {/* Eliminar -> Warning (tal cual pediste) */}
                          <button
                            onClick={() => openDelete(acc)}
                            className="ff-btn ff-btn-danger"
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
        <form onSubmit={submitTransfer} className="space-y-4">
          {tError && (
            <div
              className="text-sm rounded-[var(--radius-md)] px-3 py-2 border"
              style={{
                borderColor: "var(--border-rgba)",
                background:
                  "color-mix(in srgb, var(--danger) 14%, transparent)",
                color: "var(--text)",
              }}
            >
              {tError}
            </div>
          )}

          <div className="flex flex-col space-y-1">
            <label className="ff-label">Hacia</label>

            {/* ✅ FFSelect (custom) */}
            <FFSelect
              value={tTo}
              onChange={(v) => setTTo(v)}
              options={[
                { value: "", label: "Selecciona una cuenta", disabled: true },
                ...transferOptions,
              ]}
              placeholder="Selecciona una cuenta"
              disabled={tLoading}
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="ff-label">Monto</label>
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
              className="ff-input"
              disabled={tLoading}
              required
            />

            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Saldo real:{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {fmt(balances[tFrom]?.current)}
              </span>{" "}
              • Disponible:{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {fmt(balances[tFrom]?.available)}
              </span>
            </p>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="ff-label">Fecha</label>
            <input
              type="date"
              value={tDate}
              onChange={(e) => setTDate(e.target.value)}
              className="ff-input"
              disabled={tLoading}
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="ff-label">Descripción (opcional)</label>
            <input
              type="text"
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              className="ff-input"
              disabled={tLoading}
              placeholder="Ej: mover a ahorro"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {/* Confirmar transferencia (Primary por acción principal) */}
            <button
              type="submit"
              className="ff-btn ff-btn-primary"
              disabled={tLoading}
            >
              {tLoading ? "Transfiriendo..." : "Confirmar transferencia"}
            </button>

            <button
              type="button"
              onClick={() => setShowTransfer(false)}
              className="ff-btn ff-btn-outline"
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
            <div className="space-y-4">
              <div className="text-sm" style={{ color: "var(--text)" }}>
                <p>
                  ¿Seguro que deseas eliminar la cuenta{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {deleteAcc?.name}
                  </strong>
                  ?
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Esta acción no se puede deshacer.
                </p>

                {hasBalance && (
                  <div
                    className="mt-3 text-xs rounded-[var(--radius-md)] px-3 py-2 border"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--warning) 14%, transparent)",
                      color: "var(--text)",
                    }}
                  >
                    La cuenta tiene un saldo real de{" "}
                    <strong>{fmt(current)}</strong>. Te recomiendo transferir o
                    ajustar el saldo antes de eliminarla.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {/* Eliminar -> Warning (según tu regla) */}
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="ff-btn ff-btn-danger"
                  disabled={deleteLoading || hasBalance}
                  style={hasBalance ? { opacity: 0.6 } : undefined}
                >
                  {deleteLoading ? "Eliminando..." : "Eliminar"}
                </button>

                <button
                  type="button"
                  onClick={closeDelete}
                  className="ff-btn ff-btn-outline"
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
