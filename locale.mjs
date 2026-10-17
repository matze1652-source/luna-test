/* Luna locale policy: only reviewed translations may be enabled. */
export const SUPPORTED_LOCALES = Object.freeze(['de-DE']);
export const FALLBACK_LOCALE = 'de-DE';
export function resolveLocale(preferences = []) {
  const list = Array.isArray(preferences) ? preferences : [preferences];
  for (const candidate of list) {
    if (typeof candidate !== 'string') continue;
    const tag = candidate.trim().replace(/_/g, '-');
    if (!tag || tag.length > 35 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(tag)) continue;
    try {
      const canonical = Intl.getCanonicalLocales(tag)[0];
      if (canonical === 'de-DE' || canonical === 'de-AT' || canonical === 'de') return FALLBACK_LOCALE;
    } catch { /* Ignore malformed device preferences. */ }
  }
  return FALLBACK_LOCALE;
}
export function formatLocalDate(date, preferences = []) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('Invalid date');
  return new Intl.DateTimeFormat(resolveLocale(preferences), { day:'2-digit', month:'2-digit', year:'numeric' }).format(date);
}
