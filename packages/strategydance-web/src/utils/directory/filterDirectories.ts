import {
  type DirectoryBusinessModel,
  DirectoryCategory,
  type DirectoryType,
} from 'strategydance-knowledge/src/directories/enums'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoriesView, DirectoryState } from '~types'

import toDirectoriesView from '~utils/directory/toDirectoriesView'

type DirectoryFilters = {
  view: DirectoriesView
  // Words that must each be found in the directory's name, description or address, or the team's
  // notes on it, case aside
  query: string
  // What it charges, any when empty
  businessModels: readonly DirectoryBusinessModel[]
  // The kinds of product it lists, any when empty
  categories: readonly DirectoryCategory[]
  // A website or a Reddit community, either when null
  type: DirectoryType | null
}

/*
  The directories the page lists under its tab, its search and its filters, in the catalogue's
  order, by name. A directory taking any startup lists every kind of product, so every category
  keeps it but `REGIONAL`, which asks for a region's directories alone, as the Knowledge module's
  list has it. One the daily check has not read yet has no categories, so no category keeps it
*/
function filterDirectories(
  directories: readonly Directory[],
  states: ReadonlyMap<string, DirectoryState>,
  { view, query, businessModels, categories, type }: DirectoryFilters,
) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  return directories.filter(directory => {
    const state = states.get(directory.id)

    if (view !== 'all' && toDirectoriesView(state?.status ?? null) !== view) return false
    if (businessModels.length && !businessModels.includes(directory.businessModel)) return false
    if (type !== null && directory.type !== type) return false
    if (categories.length && !hasCategory(directory, categories)) return false
    if (!words.length) return true

    const text =
      `${directory.name} ${directory.description} ${directory.rootUrl} ${state?.notesText ?? ''}`.toLowerCase()

    return words.every(word => text.includes(word))
  })
}

function hasCategory(directory: Directory, categories: readonly DirectoryCategory[]) {
  const isAnyStartup = directory.categories.includes(DirectoryCategory.ANY_STARTUP)

  return categories.some(
    category => directory.categories.includes(category) || (isAnyStartup && category !== DirectoryCategory.REGIONAL),
  )
}

export { type DirectoryFilters }

export default filterDirectories
