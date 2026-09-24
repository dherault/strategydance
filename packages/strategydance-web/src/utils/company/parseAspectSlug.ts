import { CompanyAspect } from 'strategydance-database/web'

// The aspect a URL segment names, or null for a segment that names none
function parseAspectSlug(slug: string) {
  return Object.values(CompanyAspect).find(aspect => aspect.toLowerCase() === slug) ?? null
}

export default parseAspectSlug
