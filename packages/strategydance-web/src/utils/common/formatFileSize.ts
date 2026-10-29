import type { IntlShape } from 'react-intl'

const KILOBYTE = 1024
const MEGABYTE = 1024 * 1024

/*
  A file's size in the reader's language, as a conversation's files and a bill's receipt show it:
  in bytes under a kilobyte, in whole kilobytes under a megabyte, then in megabytes to a tenth.
  Counted in 1024s, as the limits the app states are, so a file at the limit reads as the limit
*/
function formatFileSize({ formatNumber }: IntlShape, size: number) {
  if (size < KILOBYTE) return formatNumber(size, { style: 'unit', unit: 'byte', unitDisplay: 'long' })

  if (size < MEGABYTE) {
    return formatNumber(Math.min(Math.round(size / KILOBYTE), 1023), { style: 'unit', unit: 'kilobyte' })
  }

  return formatNumber(size / MEGABYTE, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
}

export default formatFileSize
