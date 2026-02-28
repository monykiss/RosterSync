/**
 * Timezone utilities for multi-studio support.
 * All dates are stored in UTC. These helpers convert for display/logic in studio local time.
 */

/**
 * Convert a UTC Date to the studio's local time string.
 */
export function utcToStudioLocal(utcDate: Date, timezone: string): string {
  return utcDate.toLocaleString('en-US', { timeZone: timezone });
}

/**
 * Get the current time in a studio's timezone as a Date-like object.
 */
export function nowInStudioTz(timezone: string): Date {
  const localStr = new Date().toLocaleString('en-US', { timeZone: timezone });
  return new Date(localStr);
}

/**
 * Determine the weekday (0=Sun, 6=Sat) for a given UTC date in the studio's timezone.
 * Important for slot template matching — a Sunday UTC event might be Saturday local time.
 */
export function getWeekdayInTz(utcDate: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).formatToParts(utcDate);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekdayStr] ?? 0;
}

/**
 * Parse a local time string ("HH:MM") on a given date in a timezone to UTC.
 * Used during session generation to convert slot template times to UTC.
 */
export function localTimeToUtc(
  date: Date,
  timeStr: string,
  timezone: string,
): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const localDateTime = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Create a formatter to get the UTC offset for this timezone at this datetime
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Use the temporal trick: create date as if UTC, then adjust
  const asUtc = new Date(localDateTime + 'Z');
  const inTz = new Date(formatter.format(asUtc));
  const offsetMs = asUtc.getTime() - inTz.getTime();

  const targetDate = new Date(localDateTime);
  return new Date(targetDate.getTime() - offsetMs);
}
