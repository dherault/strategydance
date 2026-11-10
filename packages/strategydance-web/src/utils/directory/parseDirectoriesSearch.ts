import type { DirectoriesView } from '~types'

// The Directories page's tabs, in their order, each kept in the address as `view`, To do when left out
const DIRECTORIES_VIEWS: readonly DirectoriesView[] = ['todo', 'submitted', 'listed', 'dismissed', 'all']

type DirectoriesRouteSearch = {
  view?: DirectoriesView
}

/*
  What the Directories page reads of its query: the tab open. Anything else, To do's own name
  included, is overwritten with `undefined`, since TanStack lays what `validateSearch` returns over
  the raw query rather than replacing it
*/
function parseDirectoriesSearch(search: Record<string, unknown>): DirectoriesRouteSearch {
  return { view: DIRECTORIES_VIEWS.find(view => view === search.view && view !== 'todo') }
}

export { DIRECTORIES_VIEWS, type DirectoriesRouteSearch }

export default parseDirectoriesSearch
