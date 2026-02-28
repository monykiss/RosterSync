import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Format a UTC ISO string in the studio's local timezone.
 * Falls back to UTC formatting if timezone is not provided.
 */
export function formatInStudioTz(
    utcIso: string,
    formatStr: string,
    timezone?: string | null,
): string {
    if (!timezone) {
        return format(parseISO(utcIso), formatStr);
    }
    return formatInTimeZone(parseISO(utcIso), timezone, formatStr);
}

/**
 * Short timezone abbreviation for display, e.g. "AST", "EST", "PST"
 */
export function getTimezoneAbbr(timezone: string): string {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short',
        }).formatToParts(new Date());
        return parts.find(p => p.type === 'timeZoneName')?.value ?? timezone;
    } catch {
        return timezone;
    }
}
