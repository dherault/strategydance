export type QuotaWindow = {
  startedAt: number
  used: number
}

type DebitQuotaInput = {
  windows: Map<string, QuotaWindow>
  key: string
  amount: number
  limit: number
  windowMs: number
  now: number
}

/*
  Takes `amount` from `key`'s allowance in the current window, and answers whether it fit. A
  window opens with the first debit and lasts `windowMs`; a debit that would pass `limit` is
  refused whole and takes nothing, so a refused request does not eat into what is left.

  Expired windows are swept when the map grows, so a caller seen once does not stay in memory
  for the life of the process
*/
function debitQuota({ windows, key, amount, limit, windowMs, now }: DebitQuotaInput) {
  if (windows.size > 1000) {
    for (const [windowKey, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(windowKey)
    }
  }

  const current = windows.get(key)
  const window = current && now - current.startedAt < windowMs ? current : { startedAt: now, used: 0 }

  if (window.used + amount > limit) {
    return {
      allowed: false,
      retryAfterMs: window.startedAt + windowMs - now,
    }
  }

  windows.set(key, { startedAt: window.startedAt, used: window.used + amount })

  return {
    allowed: true,
    retryAfterMs: 0,
  }
}

export default debitQuota
