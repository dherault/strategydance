import { DirectoryCategory } from './enums'

const CATEGORIES: string[] = Object.values(DirectoryCategory)

/*
  Whether a directory's categories are as the lists hold them: known, once each, in the enum's
  order, and `ANY_STARTUP` beside nothing but `REGIONAL`, since a directory that takes any product
  takes every kind
*/
function isDirectoryCategoryListValid(categories: readonly string[]) {
  const positions = categories.map(category => CATEGORIES.indexOf(category))
  const isAnyStartupAlone =
    !categories.includes(DirectoryCategory.ANY_STARTUP)
    || categories.every(
      category => category === DirectoryCategory.ANY_STARTUP || category === DirectoryCategory.REGIONAL,
    )

  return positions.every((position, index) => position > (index ? positions[index - 1] : -1)) && isAnyStartupAlone
}

export default isDirectoryCategoryListValid
