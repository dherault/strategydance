// The addresses made for blobs some component draws, and how many draw each
const held = new Map<Blob, { url: string; holders: number }>()

/*
  Holds an address an `<img>` can draw a blob from, made the first time it is held, and answers
  what lets go of it. The address is given back to the browser once nobody holds it, a moment
  later, so a component that lets go and holds again in one go, as one subscribing anew does,
  keeps the same address. Shared, so the thread and a dialog drawing one image make one
*/
export function holdObjectUrl(blob: Blob) {
  const entry = held.get(blob) ?? { url: URL.createObjectURL(blob), holders: 0 }

  entry.holders++
  held.set(blob, entry)

  let isReleased = false

  return () => {
    if (isReleased) return

    isReleased = true
    entry.holders--

    setTimeout(() => {
      if (entry.holders > 0 || held.get(blob) !== entry) return

      held.delete(blob)
      URL.revokeObjectURL(entry.url)
    }, 0)
  }
}

// The address held for a blob, or null while nobody holds it
export function readObjectUrl(blob: Blob) {
  return held.get(blob)?.url ?? null
}
