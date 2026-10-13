/* ---
  What a run of the directories' check picks, waits for and sends
--- */

// How many active directories a run checks, and how many inactive ones it checks again, so a
// directory moved by mistake comes back
export const DIRECTORY_CHECK_COUNT = 10

export const INACTIVE_DIRECTORY_CHECK_COUNT = 1

// How many directories are checked at once
export const DIRECTORY_CHECK_CONCURRENCY = 3

/*
  How long a run starts new checks for, so what it checked is written before Cloud Run cuts the
  worker's request at fifteen minutes. A check started at the last moment can take four and a half
  more, its two probes, its review and a moved submission page's probe each at their deadline, and
  the GitHub calls around the checks a minute and a half each way at theirs
  (`GITHUB_REQUEST_TIMEOUT_MS`): 6 + 4.5 + 1.5 + 1.5 leaves a minute and a half to spare
*/
export const DIRECTORY_CHECK_BUDGET_MS = 6 * 60 * 1000

// How many days after a check first fails to reach a site a later one has to fail too before the
// site is taken for gone, so a weekend's outage retires nothing
export const DIRECTORY_UNREACHABLE_DAYS = 3

/* ---
  The probe, this server's own GET of a directory's pages
--- */

// A page's start holds what a reader sees first, which is what a check reads
export const DIRECTORY_PAGE_MAX_BYTES = 2 * 1024 * 1024

export const DIRECTORY_PAGE_TIMEOUT_MS = 15 * 1000

export const DIRECTORY_PAGE_MAX_REDIRECTS = 5

// How much of a page's text the review quotes, in characters
export const DIRECTORY_PAGE_MAX_TEXT_LENGTH = 20000

// Under this many characters of text, a page is taken for one its scripts draw
export const DIRECTORY_PAGE_MIN_TEXT_LENGTH = 300

// How many of a page's links to the same site the review is given
export const DIRECTORY_PAGE_MAX_LINKS = 60

// Where a site usually explains how a listing works, offered to a review of a page its scripts draw,
// whose links the probe cannot see
export const DIRECTORY_CONVENTIONAL_PATHS = ['/pricing', '/faq', '/submit', '/about']

/* ---
  The review, Claude reading a directory's pages
--- */

export const DIRECTORY_REVIEW_MODEL = 'claude-opus-5-5'

// Thinking counts toward it, and the request is streamed, so it can be this high
export const DIRECTORY_REVIEW_MAX_TOKENS = 32000

// The fallback model the API runs a refused request on, as a conversation's requests have it
export const DIRECTORY_REVIEW_BETAS = ['server-side-fallback-2026-07-01'] as const

// How many pages Claude fetches beyond the ones the probe read, and how much of each it reads
export const DIRECTORY_REVIEW_MAX_FETCHES = 3

export const DIRECTORY_REVIEW_MAX_FETCHED_TOKENS = 8000

// How many times a review web fetch's server-side loop paused is sent back to carry on
export const MAX_DIRECTORY_REVIEW_PAUSES = 3

// How long one directory's review may take, its paused parts included
export const DIRECTORY_REVIEW_TIMEOUT_MS = 4 * 60 * 1000

// The shortest quote taken for evidence, so a word or two found anywhere proves nothing
export const MIN_DIRECTORY_EVIDENCE_LENGTH = 12

// The longest quote taken for evidence, a sentence or so: a longer one proves nothing more, and
// would swell the pull request's description
export const MAX_DIRECTORY_EVIDENCE_LENGTH = 300

// The longest notes kept for the reviewer, in characters, past which they are cut
export const MAX_DIRECTORY_NOTES_LENGTH = 600

/*
  What the model costs, in dollars per million tokens, for the report's estimate: input, a cache
  write and a cache read, and output. A fallback model's turn is counted at these too
*/
export const DIRECTORY_REVIEW_PRICES = {
  input: 4,
  cacheCreationInput: 5,
  cacheReadInput: 0.2,
  output: 20,
} as const
