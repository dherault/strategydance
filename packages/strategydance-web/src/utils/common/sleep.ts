// Resolves once `milliseconds` have passed
function sleep(milliseconds: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds)
  })
}

export default sleep
