// The `YYYY-MM-DD` day a date picker picked, read from its local date as the picker shows it
function fromPickerDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export default fromPickerDate
