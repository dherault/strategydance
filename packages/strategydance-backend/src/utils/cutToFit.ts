// The longest beginning of a text that JSON writes in at most `budget` characters more than an empty
// string, cut between two characters, never inside one
function cutToFit(text: string, budget: number) {
  const characters = Array.from(text)
  let low = 0
  let high = characters.length

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)

    if (JSON.stringify(characters.slice(0, middle).join('')).length - 2 <= budget) low = middle
    else high = middle - 1
  }

  return characters.slice(0, low).join('')
}

export default cutToFit
