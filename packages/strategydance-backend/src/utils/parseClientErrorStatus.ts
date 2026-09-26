/*
  The 4xx status an error asks to be answered with, or null when it is not the caller's fault.

  `http-errors` is what `express.json()`, and anything else that refuses a request before a
  handler runs, throws: a malformed body as a 400, one over the parser's limit as a 413. Each
  carries the status it wants and sets `expose` to say its message is written for the caller. The
  flag is what admits it, since an error may carry a status it never meant to publish.

  A 5xx is never honoured, even when exposed: whatever it says, the caller can do nothing about it,
  and the generic answer leaks nothing
*/
function parseClientErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) return null

  const { expose, status, statusCode } = error as { expose?: unknown, status?: unknown, statusCode?: unknown }

  if (expose !== true) return null

  const code = typeof status === 'number' ? status : statusCode

  if (typeof code !== 'number' || code < 400 || code > 499) return null

  return code
}

export default parseClientErrorStatus
