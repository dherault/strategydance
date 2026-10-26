// How far a value moved from what it is compared with, as a whole percentage, or null when there
// was nothing to compare with, which the page then leaves out
function getBudgetChange(value: number, base: number) {
  return base > 0 ? Math.round(((value - base) / base) * 100) : null
}

export default getBudgetChange
