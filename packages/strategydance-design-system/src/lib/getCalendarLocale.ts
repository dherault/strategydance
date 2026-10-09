import { type DayPickerLocale, de, enUS, es, fr, ja, pt, zhCN } from 'react-day-picker/locale'

// DayPicker's locales for the ones the app speaks: the months' and weekdays' names, the day a week
// starts on, and the words of its buttons
const LOCALES: Record<string, DayPickerLocale> = { de, en: enUS, es, fr, ja, pt, zh: zhCN }

/*
  The calendar's locale for `locale`, the app's locale code ('FR') whatever its case, or English,
  whose weeks start on Sunday as the design's do, for one it does not know or none
*/
function getCalendarLocale(locale: string | undefined) {
  return LOCALES[locale?.toLowerCase() ?? ''] ?? enUS
}

export { getCalendarLocale }
