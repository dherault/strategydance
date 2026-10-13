import {
  type Directory,
  DirectoryBusinessModel,
  DirectoryInactiveReason,
  DirectoryType,
  type InactiveDirectory,
} from 'strategydance-directories'

import type { DirectoryPageProbe, DirectoryReviewAnswer } from '~types'

/*
  What the directories' tests build from: an entry at `https://<name>.example/`, its id a slug of
  its name, a page a probe read, and a review's answer, each at a plain default a test overrides
*/

export function createDirectory(name: string, fields: Partial<Directory> = {}): Directory {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    type: DirectoryType.WEBSITE,
    rootUrl: `https://${name}.example/`,
    submissionUrl: `https://${name}.example/submit`,
    description: '',
    categories: [],
    businessModel: DirectoryBusinessModel.FREE,
    lastChecked: null,
    unreachableSince: null,
    ...fields,
  }
}

export function createInactiveDirectory(name: string, fields: Partial<InactiveDirectory> = {}): InactiveDirectory {
  return { ...createDirectory(name), inactiveReason: DirectoryInactiveReason.PARKED, ...fields }
}

export function createPageProbe(url: string, fields: Partial<DirectoryPageProbe> = {}): DirectoryPageProbe {
  return {
    url,
    finalUrl: url,
    status: 200,
    outcome: 'reachable',
    failure: null,
    title: 'A directory',
    description: '',
    text: `${'A directory of tools for founders. '.repeat(10)}Listings are free once our badge is on your site.`,
    links: [],
    isClientRendered: false,
    ...fields,
  }
}

export function createAnswer(fields: Partial<DirectoryReviewAnswer> = {}): DirectoryReviewAnswer {
  return {
    verdict: 'ACTIVE',
    inactiveReason: null,
    description: 'Directory of tools for founders, where makers submit their own products.',
    isCurrentDescriptionAccurate: true,
    businessModel: null,
    evidence: null,
    submissionUrl: null,
    notes: 'The submit page explains the listing.',
    ...fields,
  }
}
