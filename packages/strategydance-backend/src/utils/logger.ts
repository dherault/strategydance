import { IS_PRODUCTION } from '~constants'

type Severity = 'INFO' | 'WARNING' | 'ERROR'

/*
  Cloud Run turns a JSON line on stdout into a structured log entry, reading its `severity` as the
  level and its `message` as the text. An error's stack goes into the message, which is where
  Error Reporting looks for one. Development prints plain lines instead, which read better in a
  terminal
*/
function write(severity: Severity, message: string, error?: unknown) {
  const detail = error instanceof Error ? error.stack ?? error.message : error === undefined ? '' : String(error)

  if (IS_PRODUCTION) {
    console.log(JSON.stringify({
      severity,
      message: detail ? `${message}\n${detail}` : message,
    }))

    return
  }

  const print = severity === 'ERROR' ? console.error : console.log

  print(detail ? `${message}\n${detail}` : message)
}

const logger = {
  info: (message: string) => write('INFO', message),
  warn: (message: string, error?: unknown) => write('WARNING', message, error),
  error: (message: string, error?: unknown) => write('ERROR', message, error),
}

export default logger
