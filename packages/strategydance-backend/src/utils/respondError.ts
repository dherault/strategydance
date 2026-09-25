import type { ApiErrorResponse } from '~types'

// Whatever can answer with an error: Express's `Response`, typed against any payload
type ErrorResponder = {
  status(code: number): ErrorResponder
  json(body: ApiErrorResponse): void
}

/*
  The error envelope every route and middleware answers with.

  It does not log. What a caller is told and what the log records are the same at some call sites
  and deliberately different at others, where the answer is vaguer than the record
*/
function respondError(response: ErrorResponder, status: number, code: string, message: string) {
  response.status(status).json({
    status: 'error',
    code,
    message,
  })
}

export default respondError
