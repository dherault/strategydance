/*
  An instant written with its fraction to six digits, so two compare as strings as they do in time:
  Data Connect writes an instant's fraction with as many digits as it needs, so `…00.87Z` is earlier
  than `…00.870168Z` though it sorts after it as written
*/
function toSortableInstant(instant: string) {
  return instant.replace(/(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/, (_, fraction: string | undefined, zone: string) => {
    return `.${(fraction ?? '').padEnd(6, '0').slice(0, 6)}${zone}`
  })
}

export default toSortableInstant
