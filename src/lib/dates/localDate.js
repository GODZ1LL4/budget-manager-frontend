const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function fromUtcDate(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

function dateKeyToUtcDate(dateKey) {
  const [year, month, day] = String(dateKey || "")
    .split("-")
    .map(Number);

  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
}

function getDateParts(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value])
    );

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
    };
  } catch {
    return {
      year: String(date.getFullYear()),
      month: pad2(date.getMonth() + 1),
      day: pad2(date.getDate()),
    };
  }
}

export function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function toLocalDateKey(value = new Date(), timeZone = getUserTimeZone()) {
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return toLocalDateKey(new Date(), timeZone);
  }

  const parts = getDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayDateKey(timeZone = getUserTimeZone()) {
  return toLocalDateKey(new Date(), timeZone);
}

export function currentMonthKey(timeZone = getUserTimeZone()) {
  return todayDateKey(timeZone).slice(0, 7);
}

export function currentYearKey(timeZone = getUserTimeZone()) {
  return todayDateKey(timeZone).slice(0, 4);
}

export function addDaysToDateKey(dateKey, days) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return fromUtcDate(date);
}

export function startOfWeekDateKey(dateKey = todayDateKey(), weekStartsOn = 1) {
  const date = dateKeyToUtcDate(dateKey);
  const day = date.getUTCDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDaysToDateKey(dateKey, -diff);
}

export function lastDayOfMonthDateKey(dateKey = todayDateKey()) {
  const [year, month] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return fromUtcDate(date);
}

export function currentMonthRange(timeZone = getUserTimeZone()) {
  const today = todayDateKey(timeZone);
  return {
    from: `${today.slice(0, 7)}-01`,
    to: today,
  };
}

export function withUserTimeZone(config = {}) {
  const timeZone = getUserTimeZone();

  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      "X-Time-Zone": timeZone,
    },
    params: {
      ...(config.params || {}),
      timeZone,
    },
  };
}
