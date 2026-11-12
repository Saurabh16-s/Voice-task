// Small timezone helpers so "tomorrow at 5pm" is resolved in the user's own timezone.

function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Milliseconds the timezone is ahead of UTC at the given instant.
function tzOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Convert a local wall-clock string ("2026-11-13T17:00" or "2026-11-13") in `timeZone` to a UTC Date.
// Strings that already carry an offset/Z are parsed as-is. Date-only values default to 09:00.
function localToUtc(local, timeZone = 'UTC') {
  if (typeof local !== 'string') return null;
  if (/(Z|[+-]\d{2}:\d{2})$/i.test(local) && local.includes('T')) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '09', mi = '00', s = '00'] = m;
  const guess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  if (Number.isNaN(guess.getTime())) return null;
  return new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
}

// "2026-11-12 18:30:00" in the given timezone.
function localNowString(timeZone, now = new Date()) {
  return now.toLocaleString('sv-SE', { timeZone });
}

function weekdayName(timeZone, now = new Date()) {
  return now.toLocaleDateString('en-US', { timeZone, weekday: 'long' });
}

module.exports = { isValidTimeZone, localToUtc, localNowString, weekdayName };
