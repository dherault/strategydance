import type { CompanyAspect } from 'strategydance-database/web'
import type { CompanyAspect as AspectSlug } from 'strategydance-design-system/components/company/CompanyAspectIcon'

// The aspect as a URL segment and as the design system names it: `STRATEGY` becomes `strategy`
function toAspectSlug(aspect: CompanyAspect) {
  return aspect.toLowerCase() as AspectSlug
}

export default toAspectSlug
