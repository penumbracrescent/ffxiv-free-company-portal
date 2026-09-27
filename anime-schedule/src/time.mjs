const formatterCache = new Map();

function formatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }));
  }
  return formatterCache.get(timeZone);
}

export function zonedParts(value, timeZone) {
  const parts = formatter(timeZone).formatToParts(value instanceof Date ? value : new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function localDateKey(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localTimeKey(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function isoWeek(value = new Date()) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { year: date.getUTCFullYear(), week: Math.ceil((((date - yearStart) / 86400000) + 1) / 7) };
}

export function addWeeksToIsoWeek({ year, week }, amount) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - day + 1 + (week - 1 + amount) * 7);
  return isoWeek(monday);
}

export function isDailyTimeDue({ now, timeZone, scheduledTime, lastSuccessAt }) {
  const today = localDateKey(now, timeZone);
  if (lastSuccessAt && localDateKey(lastSuccessAt, timeZone) === today) return false;
  return localTimeKey(now, timeZone) >= scheduledTime;
}
