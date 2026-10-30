import { type Directory, DirectoryInactiveReason, DirectoryType, type InactiveDirectory } from 'strategydance-knowledge'

import type {
  DirectoryCheck,
  DirectoryCheckOutcome,
  DirectoryLists,
  DirectoryPage,
  DirectoryReviewAnswer,
} from '~types'

import countDaysBetween from '~domain/directories/countDaysBetween'
import { DIRECTORY_PAGE_MIN_TEXT_LENGTH, DIRECTORY_UNREACHABLE_DAYS } from '~domain/directories/directoryCheckSettings'
import findEvidencePage from '~domain/directories/findEvidencePage'
import pickDirectoryFields from '~domain/directories/pickDirectoryFields'
import toSiteHost from '~domain/directories/toSiteHost'

type Applied = { lists: DirectoryLists; outcome: DirectoryCheckOutcome }

/*
  The lists once each check is applied, in turn, and what each did, for the report. Pure, and keyed
  by id, so the same checks apply again to lists read afresh when somebody pushed between the read
  and the write, and a directory renamed meanwhile is found, and left
*/
function applyDirectoryChecks(lists: DirectoryLists, checks: DirectoryCheck[], today: string) {
  const outcomes: DirectoryCheckOutcome[] = []
  let current = lists

  for (const check of checks) {
    const applied = applyDirectoryCheck(current, check, today)

    current = applied.lists
    outcomes.push(applied.outcome)
  }

  return { lists: current, outcomes }
}

/*
  One check, applied:

  - a root the probe could not reach, or found missing, counts as a strike: the first sets
    `unreachableSince`, and one `DIRECTORY_UNREACHABLE_DAYS` or more after it moves the directory to
    the inactive list, so a weekend's outage retires nothing. A root reached, or walled off for
    bots, clears it
  - a root that redirected within its site, to https or to its `www.` or away from it, moves the
    entry's addresses with it; one that left its site is the review's to judge, never followed
  - a review that answered ACTIVE writes a description and categories where there are none or the
    review found them wrong, and a business model or a submission page only on what proves it: a quote found in what
    was read, and a probe of the page that answered
  - one that answered INACTIVE moves the directory only on a quote found in what was read, and
    never takes the page the quote is on for one lacking a way to submit when its scripts draw it
  - one that answered nothing worth reading only dates the check, so a site that always fails is not
    paid for daily, and a failure of the API leaves the entry as it was
*/
function applyDirectoryCheck(lists: DirectoryLists, check: DirectoryCheck, today: string): Applied {
  const active = lists.directories.find(({ id }) => id === check.directory.id)
  const inactive = active ? undefined : lists.inactiveDirectories.find(({ id }) => id === check.directory.id)
  const entry = active ?? inactive

  if (!entry) return unchanged(lists, check.name, '', 'No longer in either list, so nothing was written')
  if (!isSameEntry(entry, check.directory)) {
    return unchanged(lists, entry.name, entry.rootUrl, 'Changed while it was checked, so its check was not applied')
  }
  if (check.review?.outcome === 'failed') return unchanged(lists, entry.name, entry.rootUrl, check.review.failure)

  const { root } = check.probe
  const changes: string[] = []
  const notes: string[] = []
  let next: Directory = { ...pickDirectoryFields(entry), lastChecked: today }

  if (root.outcome === 'reachable' && root.finalUrl) {
    const moved = moveWithinSite(lists, next, root.finalUrl)

    if (moved) {
      next = moved
      changes.push(`Moved to ${moved.rootUrl}`)
    }
  }

  if (root.outcome === 'unreachable' || root.outcome === 'missing') {
    const failure = root.failure ?? root.outcome

    if (inactive) return still(lists, { ...inactive, ...next }, changes, `Still unreachable: ${failure}`)

    if (!next.unreachableSince) {
      return keep(lists, { ...next, unreachableSince: today }, 'unreachable', changes, `Unreachable: ${failure}`)
    }

    if (countDaysBetween(next.unreachableSince, today) < DIRECTORY_UNREACHABLE_DAYS) {
      return keep(lists, next, 'unreachable', changes, `Unreachable since ${next.unreachableSince}: ${failure}`)
    }

    return moveToInactive(lists, next, DirectoryInactiveReason.UNREACHABLE, changes, null, [
      `Unreachable since ${next.unreachableSince}: ${failure}`,
    ])
  }

  if (root.outcome === 'reachable' || root.outcome === 'blocked') next.unreachableSince = null

  const review = check.review

  if (!review || review.outcome === 'unanswered') {
    const failure = review?.failure ?? 'Not reviewed'

    return inactive
      ? still(lists, { ...inactive, ...next }, changes, failure)
      : keep(lists, next, 'inconclusive', changes, failure)
  }

  const { answer } = review
  const evidencePage = answer.evidence ? findEvidencePage(answer.evidence, readPages(check, review.fetchedPages)) : null
  const isEvidenceQuoted = !!evidencePage
  // Whether the page the quote is on holds too little text to be read without its scripts, which
  // then proves nothing of a way to submit it may seem to lack
  const isClientRendered = !!evidencePage && evidencePage.text.length < DIRECTORY_PAGE_MIN_TEXT_LENGTH

  if (answer.notes) notes.push(answer.notes)

  if (answer.verdict === 'ACTIVE') {
    next = describe(lists, next, entry, answer, check, isEvidenceQuoted, changes, notes)

    if (inactive) return moveToActive(lists, next, changes, isEvidenceQuoted ? answer.evidence : null, notes)

    return keep(lists, next, 'active', changes, notes.join(' '), isEvidenceQuoted ? answer.evidence : null)
  }

  if (answer.verdict === 'INACTIVE') {
    const reason = answer.inactiveReason
    const isSubmissionReason =
      reason === DirectoryInactiveReason.NO_SUBMISSION || reason === DirectoryInactiveReason.BROKEN_SUBMISSION

    if (!reason) notes.push('Said inactive without a reason, so nothing moved.')
    else if (!isEvidenceQuoted) notes.push(`Said ${reason} without a quote found in what was read, so nothing moved.`)
    else if (isSubmissionReason && isClientRendered) {
      notes.push(`Said ${reason} from a page its scripts draw, which proves nothing, so nothing moved.`)
    } else if (inactive) {
      if (reason !== inactive.inactiveReason) changes.push(`Reason ${inactive.inactiveReason} → ${reason}`)

      return still(lists, { ...next, inactiveReason: reason }, changes, notes.join(' '), answer.evidence)
    } else {
      return moveToInactive(lists, next, reason, changes, answer.evidence, notes)
    }
  }

  if (inactive) return still(lists, { ...inactive, ...next }, changes, notes.join(' '))

  return keep(lists, next, 'inconclusive', changes, notes.join(' '))
}

// The entry an ACTIVE answer leaves: its description, categories, business model and submission
// page, each changed only on what proves it
function describe(
  lists: DirectoryLists,
  directory: Directory,
  entry: Directory,
  answer: DirectoryReviewAnswer,
  check: DirectoryCheck,
  isEvidenceQuoted: boolean,
  changes: string[],
  notes: string[],
) {
  const next = { ...directory }

  if (
    answer.description
    && answer.description !== entry.description
    && (!entry.description || !answer.isCurrentDescriptionAccurate)
  ) {
    next.description = answer.description
    changes.push(`${entry.description ? 'Description rewritten' : 'Description written'}: “${answer.description}”`)
  }

  if (
    answer.categories
    && answer.categories.join() !== entry.categories.join()
    && (!entry.categories.length || !answer.areCurrentCategoriesAccurate)
  ) {
    next.categories = answer.categories
    changes.push(
      entry.categories.length
        ? `Categories ${entry.categories.join(', ')} → ${answer.categories.join(', ')}`
        : `Categories written: ${answer.categories.join(', ')}`,
    )
  }

  if (answer.businessModel && answer.businessModel !== entry.businessModel) {
    if (isEvidenceQuoted) {
      next.businessModel = answer.businessModel
      changes.push(`Business model ${entry.businessModel} → ${answer.businessModel}`)
    } else {
      notes.push(`Read ${answer.businessModel} without a quote found in what was read, so kept ${entry.businessModel}.`)
    }
  }

  const submissionUrl = answer.submissionUrl

  if (submissionUrl && submissionUrl !== next.submissionUrl) {
    const probe = check.submissionProbe
    const isOnSite = sameOrigin(submissionUrl, next.rootUrl)

    if (
      probe?.url === submissionUrl
      && probe.outcome === 'reachable'
      && isOnSite
      && !isUsed(lists, entry.id, { submissionUrl })
    ) {
      next.submissionUrl = submissionUrl
      changes.push(`Submission page moved to ${submissionUrl}`)
    } else {
      notes.push(
        `Named ${submissionUrl} as its submission page, which was not taken: it has to be on the site and answer.`,
      )
    }
  }

  return next
}

// The entry moved along a redirect within its site, to https or to its `www.` or away from it,
// when nothing else in either list holds the new addresses
function moveWithinSite(lists: DirectoryLists, directory: Directory, finalUrl: string): Directory | null {
  if (directory.type !== DirectoryType.WEBSITE) return null

  const from = new URL(directory.rootUrl)
  const to = new URL(finalUrl)

  if (to.origin === from.origin || toSiteHost(to.href) !== toSiteHost(from.href)) return null
  if (from.protocol === 'https:' && to.protocol !== 'https:') return null

  const rootUrl = `${to.origin}/`
  const submission = new URL(directory.submissionUrl)
  const submissionUrl =
    submission.origin === from.origin
      ? `${to.origin}${submission.pathname}${submission.search}`
      : directory.submissionUrl

  if (isUsed(lists, directory.id, { rootUrl, submissionUrl })) return null

  return { ...directory, rootUrl, submissionUrl }
}

// Every page the check read, at each address it was read at: the probe's, before and after their
// redirects, and those Claude fetched
function readPages({ probe }: DirectoryCheck, fetchedPages: DirectoryPage[]) {
  const probed = [probe.root, probe.submission].flatMap(page =>
    page ? [page.url, page.finalUrl].flatMap(url => (url ? [{ url, text: page.text }] : [])) : [],
  )

  return [...probed, ...fetchedPages]
}

// Whether the entry in the lists is still the one that was checked, every field alike
function isSameEntry(entry: Directory | InactiveDirectory, checked: Directory | InactiveDirectory) {
  const reasonOf = (directory: Directory | InactiveDirectory) =>
    'inactiveReason' in directory ? directory.inactiveReason : null

  return (
    JSON.stringify(pickDirectoryFields(entry)) === JSON.stringify(pickDirectoryFields(checked))
    && reasonOf(entry) === reasonOf(checked)
  )
}

// Whether another directory, in either list, already holds one of these addresses
function isUsed(
  lists: DirectoryLists,
  id: string,
  { rootUrl, submissionUrl }: { rootUrl?: string; submissionUrl?: string },
) {
  return [...lists.directories, ...lists.inactiveDirectories].some(
    directory =>
      directory.id !== id
      && ((rootUrl && directory.type === DirectoryType.WEBSITE && directory.rootUrl === rootUrl)
        || (submissionUrl && directory.submissionUrl === submissionUrl)),
  )
}

function sameOrigin(url: string, rootUrl: string) {
  try {
    return new URL(url).origin === new URL(rootUrl).origin
  } catch {
    return false
  }
}

function replaceActive(lists: DirectoryLists, directory: Directory): DirectoryLists {
  return {
    ...lists,
    directories: lists.directories.map(existing => (existing.id === directory.id ? directory : existing)),
  }
}

function replaceInactive(lists: DirectoryLists, directory: InactiveDirectory): DirectoryLists {
  return {
    ...lists,
    inactiveDirectories: lists.inactiveDirectories.map(existing =>
      existing.id === directory.id ? directory : existing,
    ),
  }
}

function keep(
  lists: DirectoryLists,
  directory: Directory,
  result: 'active' | 'unreachable' | 'inconclusive',
  changes: string[],
  notes: string,
  evidence: DirectoryCheckOutcome['evidence'] = null,
): Applied {
  return {
    lists: replaceActive(lists, directory),
    outcome: { name: directory.name, rootUrl: directory.rootUrl, result, changes, evidence, notes },
  }
}

function still(
  lists: DirectoryLists,
  directory: InactiveDirectory,
  changes: string[],
  notes: string,
  evidence: DirectoryCheckOutcome['evidence'] = null,
): Applied {
  return {
    lists: replaceInactive(lists, directory),
    outcome: { name: directory.name, rootUrl: directory.rootUrl, result: 'inactive', changes, evidence, notes },
  }
}

function moveToInactive(
  lists: DirectoryLists,
  directory: Directory,
  reason: DirectoryInactiveReason,
  changes: string[],
  evidence: DirectoryCheckOutcome['evidence'],
  notes: string[],
): Applied {
  return {
    lists: {
      directories: lists.directories.filter(({ id }) => id !== directory.id),
      inactiveDirectories: [...lists.inactiveDirectories, { ...directory, inactiveReason: reason }],
    },
    outcome: {
      name: directory.name,
      rootUrl: directory.rootUrl,
      result: 'movedToInactive',
      changes: [...changes, `Moved to the inactive list, ${reason}`],
      evidence,
      notes: notes.join(' '),
    },
  }
}

function moveToActive(
  lists: DirectoryLists,
  directory: Directory,
  changes: string[],
  evidence: DirectoryCheckOutcome['evidence'],
  notes: string[],
): Applied {
  return {
    lists: {
      directories: [...lists.directories, { ...directory, unreachableSince: null }],
      inactiveDirectories: lists.inactiveDirectories.filter(({ id }) => id !== directory.id),
    },
    outcome: {
      name: directory.name,
      rootUrl: directory.rootUrl,
      result: 'movedToActive',
      changes: [...changes, 'Moved back to the active list'],
      evidence,
      notes: notes.join(' '),
    },
  }
}

function unchanged(lists: DirectoryLists, name: string, rootUrl: string, notes: string): Applied {
  return { lists, outcome: { name, rootUrl, result: 'notChecked', changes: [], evidence: null, notes } }
}

export default applyDirectoryChecks
