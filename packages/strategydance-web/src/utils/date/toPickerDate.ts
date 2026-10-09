/*
  A `YYYY-MM-DD` day as the local midnight a date picker shows it on. Not `toCalendarDate`'s UTC
  midnight, which a picker in a zone west of Greenwich would show as the day before
*/
function toPickerDate(date: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)

  return new Date(year, month - 1, day)
}

export default toPickerDate
