import type { DirectoryCheckOutcome, DirectoryCheckResult, DirectoryCheckUsage } from '~types'

import { DIRECTORY_REVIEW_PRICES } from '~domain/directories/directoryCheckSettings'

type Report = {
  today: string
  outcomes: DirectoryCheckOutcome[]
  // The directories picked that the run had no time for
  skipped: string[]
  usage: DirectoryCheckUsage
}

const RESULTS: Record<DirectoryCheckResult, string> = {
  active: 'Active',
  movedToInactive: 'Moved to inactive',
  movedToActive: 'Back to active',
  inactive: 'Still inactive',
  unreachable: 'Unreachable',
  inconclusive: 'Inconclusive',
  notChecked: 'Not checked',
}

/*
  A run's report, in Markdown, for its commit and its pull request: a row per directory checked,
  with what changed and the quote it rests on, and what the run's reviews cost. Every word a page or
  Claude wrote is escaped, so it can break no table nor mention anybody
*/
function formatDirectoryCheckReport({ today, outcomes, skipped, usage }: Report) {
  const counts = Object.entries(RESULTS)
    .map(([result, label]) => [label, outcomes.filter(outcome => outcome.result === result).length] as const)
    .filter(([, count]) => count)
    .map(([label, count]) => `${label.toLowerCase()} ${count}`)
  const lines = [
    `### ${today}`,
    '',
    `Checked ${outcomes.length} ${outcomes.length === 1 ? 'directory' : 'directories'}: ${counts.join(', ') || 'none'}.`,
    '',
    '| Directory | Result | Changes | Notes |',
    '| --- | --- | --- | --- |',
    ...outcomes.map(formatRow),
  ]

  if (skipped.length) lines.push('', `Out of time before: ${skipped.map(escape).join(', ')}.`)

  lines.push('', formatUsage(usage))

  return lines.join('\n')
}

function formatRow({ name, rootUrl, result, changes, evidence, notes }: DirectoryCheckOutcome) {
  const rootDestination = toLinkDestination(rootUrl)
  const directory = rootDestination ? `[${escape(name)}](${rootDestination})` : escape(name)
  const sourceDestination = evidence ? toLinkDestination(evidence.url) : null
  const source = sourceDestination ? `[source](${sourceDestination})` : 'source not a web address'
  const evidenceLine = evidence ? [`Quote: “${escape(evidence.quote)}”, ${source}`] : []

  return `| ${directory} | ${RESULTS[result]} | ${[...changes.map(escape), ...evidenceLine].join('<br>') || '-'} | ${escape(notes) || '-'} |`
}

function formatUsage({
  inputTokens,
  cacheCreationInputTokens,
  cacheReadInputTokens,
  outputTokens,
}: DirectoryCheckUsage) {
  const dollars =
    (inputTokens * DIRECTORY_REVIEW_PRICES.input
      + cacheCreationInputTokens * DIRECTORY_REVIEW_PRICES.cacheCreationInput
      + cacheReadInputTokens * DIRECTORY_REVIEW_PRICES.cacheReadInput
      + outputTokens * DIRECTORY_REVIEW_PRICES.output)
    / 1_000_000
  const count = (value: number) => value.toLocaleString('en-US')

  return `Claude: ${count(inputTokens + cacheCreationInputTokens + cacheReadInputTokens)} input tokens (${count(cacheReadInputTokens)} read from the cache), ${count(outputTokens)} output tokens, about $${dollars.toFixed(2)}.`
}

/*
  A web address as a Markdown link's destination, or null for what is not one. `encodeURI` keeps
  parentheses, so a closing one in an address Claude gave would end the link and let what follows,
  a mention say, render on its own: they are percent-encoded, as anything else that could end it is
*/
function toLinkDestination(url: string) {
  try {
    const { href, protocol } = new URL(url)

    if (protocol !== 'http:' && protocol !== 'https:') return null

    return href.replace(
      /[()<>\s]/g,
      character => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
    )
  } catch {
    return null
  }
}

/*
  Text a page or Claude wrote, made safe for a table cell on GitHub: no pipe or line break to end
  the cell, no tag, no link or image syntax, and no `@name` or `#123`, which would notify somebody
  or link an issue, a zero-width space keeping each apart
*/
export function escape(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\\|[\]<>`*_]/g, character => `\\${character}`)
    .replace(/([@#])(?=\w)/g, '$1​')
    .trim()
}

export default formatDirectoryCheckReport
