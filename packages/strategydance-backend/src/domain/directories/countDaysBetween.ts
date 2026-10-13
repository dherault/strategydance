// How many days from one UTC day (YYYY-MM-DD) to a later one
function countDaysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000))
}

export default countDaysBetween
