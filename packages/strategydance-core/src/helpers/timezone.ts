/*
  An IANA identifier, the shape `Intl.DateTimeFormat().resolvedOptions().timeZone` reports:
  slash separated segments of letters and digits, joined by underscores or hyphens
  (`America/Argentina/Buenos_Aires`, `America/Port-au-Prince`) or by a sign (`Etc/GMT+1`).

  The pattern is also what refuses the offset form (`+05:00`), which `Intl` accepts on its own:
  an offset carries no rules and so cannot survive the reader's next daylight saving change,
  and must never reach the stored field
*/
const TIMEZONE_PATTERN = /^[A-Za-z0-9]+(?:[_+-][A-Za-z0-9]+)*(?:\/[A-Za-z0-9]+(?:[_+-][A-Za-z0-9]+)*)*$/

/*
  Absent and null are both valid: a reader whose runtime reports no zone has none, which is a
  different thing from having a wrong one.

  Aliases are deliberately not canonicalized, so `Asia/Calcutta` is kept rather than rewritten
  to `Asia/Kolkata`: which of a pair a runtime calls canonical moves with its tz database, so
  normalizing here would eventually make a value this app wrote itself fail validation. Both
  resolve to the same offsets, which is all a reader of the field needs
*/
export function isValidTimezone(timezone: string | null | undefined) {
  if (timezone === null || timezone === undefined) return true
  if (!TIMEZONE_PATTERN.test(timezone)) return false

  // The only check that knows the zone exists, and a `try` because `Intl` reports an unknown
  // identifier by throwing. Worth its cost at write time: an identifier that gets stored throws
  // again in every formatter later built with it, which is on somebody's screen
  try {
    Intl.DateTimeFormat('en', { timeZone: timezone })

    return true
  }
  catch {
    return false
  }
}

// Null rather than a guess when the runtime reports nothing usable. A wrong zone is worse than
// no zone: it renders every time on the page confidently and silently in the wrong place
export function resolveSystemTimezone() {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions()

  if (!timeZone || !isValidTimezone(timeZone)) return null

  return timeZone
}
