// The Budget page's tabs, in their order, each kept in the address as `view`. Revenue joins them
// once there is any to show
const BUDGET_VIEWS = ['expenses', 'bills'] as const

type BudgetView = (typeof BUDGET_VIEWS)[number]

type BudgetRouteSearch = {
  // The tab open, Expenses when left out
  view?: BudgetView
}

/*
  What the Budget page reads of its query: the tab open. Anything else is overwritten with
  `undefined`, since TanStack lays what `validateSearch` returns over the raw query rather than
  replacing it
*/
function parseBudgetSearch(search: Record<string, unknown>): BudgetRouteSearch {
  return {
    view: BUDGET_VIEWS.find(view => view === search.view),
  }
}

export { BUDGET_VIEWS, type BudgetRouteSearch, type BudgetView }

export default parseBudgetSearch
