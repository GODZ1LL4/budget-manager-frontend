import { useMemo, useRef, useState } from "react";
import { HiDownload, HiUpload } from "react-icons/hi";
import Modal from "./Modal";
import FFSelect from "./FFSelect";

const HEADER_ALIASES = {
  date: ["fecha", "date", "transaction date", "fecha transaccion"],
  description: [
    "descripcion",
    "description",
    "concepto",
    "detalle",
    "memo",
    "nota",
    "notas",
    "comercio",
    "merchant",
  ],
  amount: ["monto", "amount", "total", "importe", "valor", "value"],
  debit: ["debito", "debit", "cargo", "retiro", "withdrawal", "salida"],
  credit: ["credito", "credit", "abono", "deposito", "deposit", "entrada"],
  type: ["tipo", "type", "tipo transaccion", "transaction type", "movimiento"],
  accountId: ["account_id", "cuenta_id", "id cuenta", "account id"],
  account: ["cuenta", "account", "cuenta origen", "account name"],
  categoryId: ["category_id", "categoria_id", "id categoria", "category id"],
  category: ["categoria", "category", "rubro"],
};

const EXPENSE_TYPES = new Set([
  "expense",
  "gasto",
  "egreso",
  "debit",
  "debito",
  "cargo",
  "retiro",
  "salida",
]);

const INCOME_TYPES = new Set([
  "income",
  "ingreso",
  "credit",
  "credito",
  "abono",
  "deposito",
  "entrada",
]);

const TRANSFER_TYPES = new Set([
  "transfer",
  "transferencia",
  "traspaso",
  "movimientoentrecuentas",
]);

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeLookup(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactKey(value) {
  return normalizeLookup(value).replace(/[^a-z0-9]+/g, "");
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map(cleanText);
}

function detectDelimiter(headerLine) {
  return [";", ",", "\t"].reduce(
    (best, delimiter) => {
      const count = parseDelimitedLine(headerLine, delimiter).length;
      return count > best.count ? { delimiter, count } : best;
    },
    { delimiter: ";", count: 0 }
  ).delimiter;
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const parsed = lines.map((line) => parseDelimitedLine(line, delimiter));
  return {
    headers: parsed[0] || [],
    rows: parsed.slice(1),
  };
}

function findHeaderIndex(headers, aliases) {
  const normalizedHeaders = headers.map(compactKey);

  for (const alias of aliases) {
    const index = normalizedHeaders.indexOf(compactKey(alias));
    if (index >= 0) return index;
  }

  return -1;
}

function buildHeaderMap(headers) {
  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [
      key,
      findHeaderIndex(headers, aliases),
    ])
  );
}

function getCell(row, index) {
  return index >= 0 ? cleanText(row[index]) : "";
}

function parseMoney(raw) {
  const original = cleanText(raw);
  if (!original) return NaN;

  const hasParens = /^\(.*\)$/.test(original);
  const isNegative = hasParens || original.includes("-");
  let value = original.replace(/[^\d,.-]/g, "").replace(/-/g, "");

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    value = value.replace(new RegExp(`\\${thousandSep}`, "g"), "");
    value = value.replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    const decimals = value.length - lastComma - 1;
    value =
      decimals > 0 && decimals <= 2
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    value =
      decimals > 0 && decimals <= 2
        ? value.replace(/,/g, "")
        : value.replace(/\./g, "");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return isNegative ? -parsed : parsed;
}

function buildDateKey(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(raw) {
  const value = cleanText(raw);
  if (!value) return "";

  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return buildDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return buildDateKey(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3])
    );
  }

  const split = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (split) {
    let first = Number(split[1]);
    let second = Number(split[2]);
    let year = Number(split[3]);
    if (year < 100) year += 2000;

    const monthFirst = first <= 12 && second > 12;
    const day = monthFirst ? second : first;
    const month = monthFirst ? first : second;
    return buildDateKey(year, month, day);
  }

  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 25569 && serial < 60000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return buildDateKey(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  }

  return "";
}

function resolveByIdOrName(items, ...values) {
  const cleanedValues = values.map(cleanText).filter(Boolean);

  for (const value of cleanedValues) {
    const byId = items.find((item) => String(item.id) === value);
    if (byId) return byId;
  }

  for (const value of cleanedValues) {
    const target = normalizeLookup(value);
    const byName = items.find((item) => normalizeLookup(item.name) === target);
    if (byName) return byName;
  }

  return null;
}

function resolveType(
  rawType,
  amount,
  debitAmount,
  creditAmount,
  category,
  fallbackType
) {
  const key = compactKey(rawType);
  if (EXPENSE_TYPES.has(key)) return "expense";
  if (INCOME_TYPES.has(key)) return "income";
  if (TRANSFER_TYPES.has(key)) return "transfer";
  if (Number.isFinite(debitAmount) && debitAmount > 0) return "expense";
  if (Number.isFinite(creditAmount) && creditAmount > 0) return "income";
  if (category?.type === "expense" || category?.type === "income") {
    return category.type;
  }
  if (fallbackType === "expense" || fallbackType === "income") {
    return fallbackType;
  }
  return amount < 0 ? "expense" : "income";
}

function buildPreviewRows({
  text,
  accounts,
  categories,
  defaults,
  t,
}) {
  const { headers, rows } = parseCsv(text);
  const headerMap = buildHeaderMap(headers);

  if (!headers.length || headerMap.date < 0) {
    throw new Error(t("transactions.csvHeaderError"));
  }

  if (headerMap.amount < 0 && headerMap.debit < 0 && headerMap.credit < 0) {
    throw new Error(t("transactions.csvAmountHeaderError"));
  }

  const defaultAccount = accounts.find(
    (account) => String(account.id) === String(defaults.accountId || "")
  );
  const defaultExpenseCategory = categories.find(
    (category) =>
      category.type === "expense" &&
      String(category.id) === String(defaults.expenseCategoryId || "")
  );
  const defaultIncomeCategory = categories.find(
    (category) =>
      category.type === "income" &&
      String(category.id) === String(defaults.incomeCategoryId || "")
  );

  return rows.map((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    const rawDate = getCell(row, headerMap.date);
    const rawDescription = getCell(row, headerMap.description);
    const rawAmount = getCell(row, headerMap.amount);
    const rawDebit = getCell(row, headerMap.debit);
    const rawCredit = getCell(row, headerMap.credit);
    const rawType = getCell(row, headerMap.type);
    const rawAccount = getCell(row, headerMap.account);
    const rawAccountId = getCell(row, headerMap.accountId);
    const rawCategory = getCell(row, headerMap.category);
    const rawCategoryId = getCell(row, headerMap.categoryId);

    const explicitAccount = resolveByIdOrName(
      accounts,
      rawAccountId,
      rawAccount
    );
    const explicitCategory = resolveByIdOrName(
      categories,
      rawCategoryId,
      rawCategory
    );

    const parsedAmount = parseMoney(rawAmount);
    const debitAmount = parseMoney(rawDebit);
    const creditAmount = parseMoney(rawCredit);
    let signedAmount = parsedAmount;

    if (!Number.isFinite(signedAmount) || signedAmount === 0) {
      if (Number.isFinite(debitAmount) && debitAmount > 0) {
        signedAmount = -Math.abs(debitAmount);
      } else if (Number.isFinite(creditAmount) && creditAmount > 0) {
        signedAmount = Math.abs(creditAmount);
      }
    }

    const date = parseDateKey(rawDate);
    const fallbackType =
      defaultExpenseCategory && !defaultIncomeCategory
        ? "expense"
        : defaultIncomeCategory && !defaultExpenseCategory
        ? "income"
        : "";
    const type = resolveType(
      rawType,
      signedAmount,
      debitAmount,
      creditAmount,
      explicitCategory,
      fallbackType
    );
    const amount = Math.abs(Number(signedAmount || 0));
    const fallbackCategory =
      type === "expense" ? defaultExpenseCategory : defaultIncomeCategory;
    const category =
      explicitCategory && explicitCategory.type === type
        ? explicitCategory
        : fallbackCategory;
    const account = explicitAccount || defaultAccount;
    const errors = [];
    const warnings = [];

    if (!date) errors.push(t("transactions.csvMissingDate"));
    if (!amount || amount <= 0) errors.push(t("transactions.csvMissingAmount"));
    if (type === "transfer") errors.push(t("transactions.csvUnsupportedTransfer"));
    if (type !== "expense" && type !== "income" && type !== "transfer") {
      errors.push(t("transactions.csvTypeUnsupported"));
    }
    if (!account) errors.push(t("transactions.csvMissingAccount"));
    if (!category && type !== "transfer") {
      errors.push(t("transactions.csvMissingCategory"));
    }

    if ((rawAccount || rawAccountId) && !explicitAccount) {
      warnings.push(t("transactions.csvUnmatchedAccount"));
    }
    if (!explicitAccount && defaultAccount) {
      warnings.push(t("transactions.csvUsedDefaultAccount"));
    }
    if ((rawCategory || rawCategoryId) && !explicitCategory) {
      warnings.push(t("transactions.csvUnmatchedCategory"));
    }
    if (explicitCategory && explicitCategory.type !== type) {
      warnings.push(t("transactions.csvCategoryTypeMismatch"));
    }
    if (
      (!explicitCategory || explicitCategory.type !== type) &&
      fallbackCategory &&
      type !== "transfer"
    ) {
      warnings.push(t("transactions.csvUsedDefaultCategory"));
    }

    const payload =
      errors.length === 0
        ? {
            amount,
            account_id: account.id,
            category_id: category.id,
            type,
            description: rawDescription,
            date,
            recurrence: null,
            recurrence_end_date: null,
            items: [],
            discount: 0,
          }
        : null;

    return {
      id: `${lineNumber}-${rawDate}-${rawAmount}-${rawDescription}`,
      lineNumber,
      date,
      description: rawDescription,
      amount,
      type,
      account,
      category,
      errors,
      warnings,
      payload,
    };
  });
}

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTemplate(accounts, categories) {
  const accountName = accounts[0]?.name || "Cuenta principal";
  const expenseCategory =
    categories.find((category) => category.type === "expense")?.name ||
    "Supermercado";
  const incomeCategory =
    categories.find((category) => category.type === "income")?.name ||
    "Salario";
  const date = todayKey();
  const rows = [
    ["fecha", "descripcion", "tipo", "monto", "cuenta", "categoria"],
    [date, "Compra supermercado", "gasto", "1250.50", accountName, expenseCategory],
    [date, "Nomina", "ingreso", "50000.00", accountName, incomeCategory],
  ];
  const content = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-transacciones.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function ImportTransactionsModal({
  isOpen,
  onClose,
  accounts,
  categories,
  onImport,
  formatCurrency,
  t,
}) {
  const fileInputRef = useRef(null);
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [defaultExpenseCategoryId, setDefaultExpenseCategoryId] = useState("");
  const [defaultIncomeCategoryId, setDefaultIncomeCategoryId] = useState("");

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name })),
    [accounts]
  );
  const expenseCategoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === "expense")
        .map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );
  const incomeCategoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === "income")
        .map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const preview = useMemo(() => {
    if (!sourceText) return { rows: [], error: "" };

    try {
      return {
        rows: buildPreviewRows({
          text: sourceText,
          accounts,
          categories,
          defaults: {
            accountId: defaultAccountId,
            expenseCategoryId: defaultExpenseCategoryId,
            incomeCategoryId: defaultIncomeCategoryId,
          },
          t,
        }),
        error: "",
      };
    } catch (err) {
      return { rows: [], error: err?.message || t("transactions.csvReadError") };
    }
  }, [
    accounts,
    categories,
    defaultAccountId,
    defaultExpenseCategoryId,
    defaultIncomeCategoryId,
    sourceText,
    t,
  ]);

  const readyRows = useMemo(
    () => preview.rows.filter((row) => row.payload),
    [preview.rows]
  );
  const invalidRows = preview.rows.length - readyRows.length;
  const totals = useMemo(
    () =>
      readyRows.reduce(
        (acc, row) => {
          if (row.type === "income") acc.income += row.amount;
          if (row.type === "expense") acc.expense += row.amount;
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [readyRows]
  );

  const reset = () => {
    setSourceText("");
    setFileName("");
    setError("");
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSourceText("");
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      setSourceText(String(readerEvent.target?.result || ""));
    };
    reader.onerror = () => setError(t("transactions.csvReadError"));
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!readyRows.length) {
      setError(t("transactions.csvNoValidRows"));
      return;
    }

    setImporting(true);
    setError("");

    try {
      await onImport(readyRows.map((row) => row.payload));
      reset();
      onClose();
    } catch (err) {
      setError(err?.message || t("transactions.importTransactionsError"));
    } finally {
      setImporting(false);
    }
  };

  const visibleError = error || preview.error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("transactions.importTransactionsTitle")}
      size="xl"
    >
      <div className="space-y-5 text-sm" style={{ color: "var(--text)" }}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-2">
            <label className="ff-label">{t("transactions.importTransactionsFile")}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="
                block w-full text-sm
                file:mr-3 file:rounded-lg file:border file:border-transparent
                file:px-4 file:py-2 file:text-sm file:font-semibold
                file:bg-[var(--primary)] file:text-[var(--primary-contrast,var(--bg-1))]
                hover:file:brightness-110 active:file:scale-95 file:transition-all
                text-[var(--muted)]
              "
              style={{ background: "transparent" }}
              disabled={importing}
            />
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              {t("transactions.importTransactionsHint")}
            </p>
            {fileName && (
              <p className="font-mono text-xs text-[var(--muted)]">{fileName}</p>
            )}
          </div>

          <div className="flex items-start justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => downloadTemplate(accounts, categories)}
              className="ff-btn ff-btn-outline inline-flex items-center gap-2"
              disabled={importing}
            >
              <HiDownload className="h-4 w-4" aria-hidden="true" />
              {t("transactions.importTransactionsTemplate")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("transactions.defaultAccount")}</label>
            <FFSelect
              value={defaultAccountId}
              onChange={(value) => {
                setDefaultAccountId(value);
                setError("");
              }}
              options={accountOptions}
              placeholder={t("transactions.optionalDefault")}
              disabled={importing}
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("transactions.defaultExpenseCategory")}</label>
            <FFSelect
              value={defaultExpenseCategoryId}
              onChange={(value) => {
                setDefaultExpenseCategoryId(value);
                setError("");
              }}
              options={expenseCategoryOptions}
              placeholder={t("transactions.optionalDefault")}
              disabled={importing}
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("transactions.defaultIncomeCategory")}</label>
            <FFSelect
              value={defaultIncomeCategoryId}
              onChange={(value) => {
                setDefaultIncomeCategoryId(value);
                setError("");
              }}
              options={incomeCategoryOptions}
              placeholder={t("transactions.optionalDefault")}
              disabled={importing}
            />
          </div>
        </div>

        {visibleError && (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "color-mix(in srgb, var(--danger) 45%, var(--border-rgba))",
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
            }}
          >
            {visibleError}
          </div>
        )}

        <div
          className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-5"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 76%, transparent)",
          }}
        >
          <SummaryStat label={t("transactions.rowsRead")} value={preview.rows.length} />
          <SummaryStat label={t("transactions.readyToImport")} value={readyRows.length} tone="success" />
          <SummaryStat label={t("transactions.withIssues")} value={invalidRows} tone={invalidRows ? "danger" : "muted"} />
          <SummaryStat label={t("transactions.totalIncome")} value={formatCurrency(totals.income)} tone="success" />
          <SummaryStat label={t("transactions.totalExpense")} value={formatCurrency(totals.expense)} tone="danger" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[var(--text)]">
              {t("transactions.importPreview")}
            </h4>
            {readyRows.length > 0 && (
              <span className="font-mono text-xs text-[var(--muted)]">
                {readyRows.length}/{preview.rows.length}
              </span>
            )}
          </div>

          <div
            className="max-h-72 overflow-auto rounded-lg border"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 70%, transparent)",
            }}
          >
            {preview.rows.length === 0 ? (
              <div className="px-3 py-4 text-sm italic text-[var(--muted)]">
                {t("transactions.emptyImportPreview")}
              </div>
            ) : (
              <table className="w-full min-w-[860px] text-xs sm:text-sm">
                <thead>
                  <tr
                    className="text-left"
                    style={{
                      background: "color-mix(in srgb, var(--panel) 88%, transparent)",
                      color: "var(--muted)",
                      borderBottom: "1px solid var(--border-rgba)",
                    }}
                  >
                    <th className="px-3 py-2">{t("transactions.status")}</th>
                    <th className="px-3 py-2">{t("transactions.row")}</th>
                    <th className="px-3 py-2">{t("transactions.date")}</th>
                    <th className="px-3 py-2">{t("transactions.description")}</th>
                    <th className="px-3 py-2">{t("transactions.type")}</th>
                    <th className="px-3 py-2 text-right">{t("transactions.amount")}</th>
                    <th className="px-3 py-2">{t("transactions.account")}</th>
                    <th className="px-3 py-2">{t("transactions.category")}</th>
                    <th className="px-3 py-2">{t("transactions.warnings")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => {
                    const isReady = Boolean(row.payload);
                    const rowBg =
                      index % 2 === 0
                        ? "color-mix(in srgb, var(--panel) 74%, transparent)"
                        : "color-mix(in srgb, var(--panel) 82%, transparent)";
                    const statusColor = isReady ? "var(--success)" : "var(--danger)";
                    const notes = [...row.errors, ...row.warnings].join(" | ");

                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: rowBg,
                          borderTop: index === 0 ? "none" : "1px solid color-mix(in srgb, var(--border-rgba) 70%, transparent)",
                        }}
                      >
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: statusColor,
                              borderColor: `color-mix(in srgb, ${statusColor} 45%, var(--border-rgba))`,
                              background: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
                            }}
                          >
                            {isReady ? t("transactions.ready") : t("transactions.invalid")}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[var(--muted)]">
                          {row.lineNumber}
                        </td>
                        <td className="px-3 py-2 font-mono">{row.date || "-"}</td>
                        <td className="max-w-[220px] truncate px-3 py-2">
                          {row.description || t("transactions.noDescription")}
                        </td>
                        <td className="px-3 py-2">
                          {row.type === "income"
                            ? t("transactions.income")
                            : row.type === "expense"
                            ? t("transactions.expense")
                            : t("transactions.transfer")}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {row.amount ? formatCurrency(row.amount) : "-"}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2">
                          {row.account?.name || "-"}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2">
                          {row.category?.name || "-"}
                        </td>
                        <td className="max-w-[260px] px-3 py-2 text-[11px] text-[var(--muted)]">
                          {notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="ff-btn ff-btn-outline"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || readyRows.length === 0}
            className="ff-btn ff-btn-primary inline-flex items-center justify-center gap-2"
            style={
              importing || readyRows.length === 0
                ? { opacity: 0.55, cursor: "not-allowed", boxShadow: "none" }
                : undefined
            }
          >
            <HiUpload className="h-4 w-4" aria-hidden="true" />
            {importing ? t("transactions.importing") : t("transactions.import")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryStat({ label, value, tone = "muted" }) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
      ? "var(--danger)"
      : "var(--text)";

  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-1 truncate font-mono text-sm font-semibold leading-tight sm:text-base"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
