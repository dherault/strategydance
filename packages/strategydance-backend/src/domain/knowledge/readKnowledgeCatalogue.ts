import type { KnowledgeKind } from 'strategydance-core'
import { DIRECTORIES, INACTIVE_DIRECTORIES, MARKETING_TACTICS, STRATEGIC_FRAMEWORKS } from 'strategydance-knowledge'

import type { KnowledgeEntry } from '~types'

// A kind's items, sorted by name as the package keeps them, and apart, the directories that take no
// submission today, which no list shows but a read finds
type KnowledgeCatalogue = {
  items: KnowledgeEntry[]
  inactive: KnowledgeEntry[]
}

// The package's lists as the release ships them, read once as the backend starts
const CATALOGUES: Record<KnowledgeKind, KnowledgeCatalogue> = {
  STRATEGIC_FRAMEWORK: {
    items: STRATEGIC_FRAMEWORKS.map(item => ({ kind: 'STRATEGIC_FRAMEWORK', item })),
    inactive: [],
  },
  MARKETING_TACTIC: {
    items: MARKETING_TACTICS.map(item => ({ kind: 'MARKETING_TACTIC', item })),
    inactive: [],
  },
  DIRECTORY: {
    items: DIRECTORIES.map(item => ({ kind: 'DIRECTORY', item })),
    inactive: INACTIVE_DIRECTORIES.map(item => ({ kind: 'DIRECTORY', item })),
  },
}

// The knowledge package's list for a kind, which the module reads and never writes
function readKnowledgeCatalogue(kind: KnowledgeKind) {
  return CATALOGUES[kind]
}

export default readKnowledgeCatalogue
