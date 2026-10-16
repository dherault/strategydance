import { BotIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { ModuleName } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Dialog, DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import useCanUseModules from '~hooks/module/useCanUseModules'

import getModuleMessages from '~utils/module/getModuleMessages'

import ModuleAgentsDialog from '~components/module/ModuleAgentsDialog'

type Props = {
  module: ModuleName
}

/*
  A module's page's agents button, an icon whose tooltip says what an agent of the member's own may
  do there, which opens the dialog telling how to connect one, and takes the focus back once it
  closes. Nothing for a reader who may not connect one yet, while modules are for Strategy Dance's
  administrators alone. It sits in the page's toolbar after the page's own action, so it takes the
  fields' height
*/
function ModuleAgentsButton({ module }: Props) {
  const { formatMessage } = useIntl()
  const canUseModules = useCanUseModules()

  if (!canUseModules) return null

  const label = formatMessage(getModuleMessages(module).agentsButton)

  return (
    <Dialog>
      <Tooltip content={label}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            icon={<BotIcon />}
            aria-label={label}
          />
        </DialogTrigger>
      </Tooltip>
      <ModuleAgentsDialog module={module} />
    </Dialog>
  )
}

export default ModuleAgentsButton
