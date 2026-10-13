import { RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  isValidIntegrationApiKey,
  isValidIntegrationApiKeyHeader,
  isValidIntegrationName,
  MAX_INTEGRATION_NAME_LENGTH,
  normalizeIntegrationName,
  parseIntegrationUrl,
} from 'strategydance-core'
import { IntegrationApiKeyScheme, IntegrationAuthentication, IntegrationError } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Select } from 'strategydance-design-system/components/ui/Select'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import type { ExternalMcpServer } from 'strategydance-external-mcp-servers'

import type { OrganizationIntegration } from '~types'

import useNow from '~hooks/common/useNow'
import useIntegrationRequests from '~hooks/integration/useIntegrationRequests'

import getIntegrationAuthenticationMessage from '~utils/integration/getIntegrationAuthenticationMessage'
import getIntegrationFailureMessage from '~utils/integration/getIntegrationFailureMessage'
import getIntegrationHost from '~utils/integration/getIntegrationHost'
import readIntegrationFailure, { type IntegrationFailure } from '~utils/integration/readIntegrationFailure'

import PasswordInput from '~components/common/PasswordInput'
import Spinner from '~components/common/Spinner'
import IntegrationLastUsed from '~components/integration/IntegrationLastUsed'
import IntegrationTools from '~components/integration/IntegrationTools'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  // The server opened, or null for one being added
  integration: OrganizationIntegration | null
  // The external MCP server a server being added starts from, or null for one added by its address
  preset: ExternalMcpServer | null
  // Every server of the organization, whose names a name may not take
  integrations: OrganizationIntegration[]
  isAdministrator: boolean
  onClose: () => void
  onDelete: (integration: OrganizationIntegration) => void
}

// Failures that concern one field, said under it rather than above the form
const KEY_FAILURES: IntegrationFailure[] = [IntegrationError.KEY_REFUSED]

/*
  A server's dialog: adding one, or reading and changing one, as designed. Its name, its address, how
  it lets Strategy Dance in, and for a key-based server the key and how it is sent; for a server
  that exists, the error of its last try with Retry, its tools, and Delete.

  The form checks what strategydance-core says each field may be before anything is sent, and what
  the backend answers lands beside the field it concerns: a key refused under the key, a name taken
  under the name, anything else above the form. The key is sent only when typed: left empty, the
  stored one stays, unless the address or the authentication changed, since a key is never sent to
  another server than the one it was given for.

  Members who do not administer the organization read it all and change nothing
*/
function IntegrationDialog({ integration, preset, integrations, isAdministrator, onClose, onDelete }: Props) {
  const { formatMessage } = useIntl()
  const now = useNow()
  const { addIntegration, editIntegration, retryIntegration } = useIntegrationRequests()

  const [name, setName] = useState(integration?.name ?? preset?.name ?? '')
  const [url, setUrl] = useState(integration?.url ?? preset?.url ?? 'https://')
  const [authentication, setAuthentication] = useState<IntegrationAuthentication>(
    integration?.authentication
      ?? (preset ? IntegrationAuthentication[preset.authentication] : IntegrationAuthentication.OAUTH),
  )
  const [apiKey, setApiKey] = useState('')
  const [apiKeyScheme, setApiKeyScheme] = useState<IntegrationApiKeyScheme>(
    integration?.apiKeyScheme
      ?? (preset?.apiKeyScheme ? IntegrationApiKeyScheme[preset.apiKeyScheme] : IntegrationApiKeyScheme.BEARER),
  )
  const [apiKeyHeader, setApiKeyHeader] = useState(integration?.apiKeyHeader ?? preset?.apiKeyHeader ?? '')
  const [isTouched, setIsTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [failure, setFailure] = useState<IntegrationFailure | null>(null)

  const isReadOnly = !isAdministrator
  const parsedUrl = parseIntegrationUrl(url)
  const isKeyed = authentication === IntegrationAuthentication.API_KEY
  const isHeaderScheme = isKeyed && apiKeyScheme === IntegrationApiKeyScheme.HEADER
  const isServerChanged =
    integration !== null && (parsedUrl !== integration.url || authentication !== integration.authentication)
  const hadKey = integration?.authentication === IntegrationAuthentication.API_KEY
  // A short key keeps no last four, which would give it away
  const lastFour = integration?.apiKeyLastFour ?? null
  const isKeyKept = hadKey && !isServerChanged
  const isSchemeChanged =
    integration !== null
    && isKeyed
    && (apiKeyScheme !== integration.apiKeyScheme
      || (isHeaderScheme && apiKeyHeader.trim() !== (integration.apiKeyHeader ?? '')))
  const isChanged =
    integration === null || name.trim() !== integration.name || isServerChanged || Boolean(apiKey) || isSchemeChanged

  const nameError = getNameError()
  const urlError = parsedUrl === null ? integrationMessages.urlInvalid : null
  const keyError = getKeyError()
  const headerError =
    isHeaderScheme && !isValidIntegrationApiKeyHeader(apiKeyHeader.trim())
      ? integrationMessages.apiKeyHeaderInvalid
      : null
  const isInvalid = Boolean(nameError || urlError || keyError || headerError)
  const formFailure = failure && !KEY_FAILURES.includes(failure) && failure !== 'nameTaken' ? failure : null

  function getNameError() {
    if (!name.trim()) return integrationMessages.nameRequired
    if (!isValidIntegrationName(name)) return integrationMessages.nameInvalid

    const normalized = normalizeIntegrationName(name)
    const isTaken = integrations.some(
      other => other.id !== integration?.id && normalizeIntegrationName(other.name) === normalized,
    )

    return isTaken ? integrationMessages.nameTaken : null
  }

  function getKeyError() {
    if (!isKeyed) return null
    if (apiKey) return isValidIntegrationApiKey(apiKey) ? null : integrationMessages.apiKeyInvalid
    if (!hadKey) return integrationMessages.apiKeyRequired

    return isServerChanged ? integrationMessages.apiKeyRequiredAgain : null
  }

  // Any change to the form sets aside what the backend last answered about it
  function change<Value>(setter: (value: Value) => void) {
    return (value: Value) => {
      setter(value)
      setFailure(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsTouched(true)

    if (isReadOnly || isInvalid || !isChanged || isSaving || parsedUrl === null) return

    const settings = {
      name: name.trim(),
      url: parsedUrl,
      authentication,
      apiKey: isKeyed && apiKey ? apiKey : null,
      apiKeyScheme: isKeyed ? apiKeyScheme : IntegrationApiKeyScheme.BEARER,
      apiKeyHeader: isHeaderScheme ? apiKeyHeader.trim() : null,
    }

    setIsSaving(true)
    setFailure(null)

    try {
      if (integration) {
        await editIntegration(integration.id, settings)
        toast.success(formatMessage(integrationMessages.saved))
      } else {
        const added = await addIntegration(settings)

        toast.success(
          authentication === IntegrationAuthentication.OAUTH
            ? formatMessage(integrationMessages.added, { name: settings.name })
            : formatMessage(integrationMessages.addedWithTools, { name: settings.name, count: added.toolCount }),
        )
      }

      onClose()
    } catch (error) {
      console.error('A server could not be saved', error)
      setFailure(readIntegrationFailure(error))
      setIsSaving(false)
    }
  }

  async function retry() {
    if (!integration) return

    setIsRetrying(true)

    try {
      await retryIntegration(integration.id)
      toast.success(formatMessage(integrationMessages.reachable, { name: integration.name }))
    } catch (error) {
      console.error('A server could not be reached again', error)

      const retried = readIntegrationFailure(error)

      // How reaching it failed is its error now, which the alert shows as it arrives
      if (!Object.values(IntegrationError).includes(retried as IntegrationError)) {
        toast.error(formatMessage(getIntegrationFailureMessage(retried)))
      }
    } finally {
      setIsRetrying(false)
    }
  }

  function showError(error: Parameters<typeof formatMessage>[0] | null) {
    return isTouched && error ? formatMessage(error) : null
  }

  const authenticationOptions = Object.values(IntegrationAuthentication).map(value => ({
    value,
    label: formatMessage(getIntegrationAuthenticationMessage(value)),
  }))

  const title = integration
    ? integration.name
    : preset
      ? formatMessage(integrationMessages.addCatalogueServer, { name: preset.name })
      : formatMessage(integrationMessages.dialogAddTitle)

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(integrationMessages.close)}
        className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[560px]"
      >
        <form
          onSubmit={handleSubmit}
          noValidate
          className="grid min-w-0 gap-5"
        >
          <DialogHeader>
            <DialogTitle className="break-words">{title}</DialogTitle>
            <DialogDescription>
              {integration
                ? formatMessage(integrationMessages.dialogDescription, {
                    host: getIntegrationHost(integration.url),
                    authentication: formatMessage(getIntegrationAuthenticationMessage(integration.authentication)),
                    lastUsed: (
                      <IntegrationLastUsed
                        key="lastUsed"
                        lastUsedAt={integration.lastUsedAt ?? null}
                        now={now}
                      />
                    ),
                  })
                : formatMessage(integrationMessages.dialogAddDescription)}
            </DialogDescription>
          </DialogHeader>
          {integration?.lastError && integration.isEnabled ? (
            <Alert
              variant="danger"
              actions={
                isAdministrator ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRetrying}
                    icon={isRetrying ? <Spinner tone="current" /> : <RefreshCwIcon />}
                    onClick={retry}
                  >
                    {formatMessage(integrationMessages.retry)}
                  </Button>
                ) : null
              }
            >
              {formatMessage(getIntegrationFailureMessage(integration.lastError))}
            </Alert>
          ) : null}
          {formFailure ? (
            <Alert variant="danger">{formatMessage(getIntegrationFailureMessage(formFailure))}</Alert>
          ) : null}
          <Input
            label={formatMessage(integrationMessages.nameLabel)}
            value={name}
            maxLength={MAX_INTEGRATION_NAME_LENGTH}
            placeholder={formatMessage(integrationMessages.namePlaceholder)}
            disabled={isReadOnly}
            error={failure === 'nameTaken' ? formatMessage(integrationMessages.nameTaken) : showError(nameError)}
            autoFocus={!integration && !preset}
            onChange={event => change(setName)(event.target.value)}
          />
          <Input
            label={formatMessage(integrationMessages.urlLabel)}
            value={url}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://mcp.example.com"
            disabled={isReadOnly}
            hint={formatMessage(integrationMessages.urlHint)}
            error={showError(urlError)}
            onChange={event => change(setUrl)(event.target.value)}
          />
          <Select
            label={formatMessage(integrationMessages.authenticationLabel)}
            value={authentication}
            options={authenticationOptions}
            disabled={isReadOnly}
            onValueChange={value => change(setAuthentication)(value as IntegrationAuthentication)}
          />
          {isKeyed && !isReadOnly ? (
            <>
              <PasswordInput
                label={formatMessage(integrationMessages.apiKeyLabel)}
                value={apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={isKeyKept ? (lastFour ? `•••• ${lastFour}` : '••••••••') : 'sk_live_…'}
                hint={
                  isKeyKept
                    ? lastFour
                      ? formatMessage(integrationMessages.apiKeyKeepHint, { lastFour })
                      : formatMessage(integrationMessages.apiKeyKeepHintShort)
                    : null
                }
                error={
                  failure && KEY_FAILURES.includes(failure)
                    ? formatMessage(getIntegrationFailureMessage(failure))
                    : showError(keyError)
                }
                onChange={event => change(setApiKey)(event.target.value)}
              />
              <Select
                label={formatMessage(integrationMessages.apiKeySchemeLabel)}
                value={apiKeyScheme}
                options={[
                  {
                    value: IntegrationApiKeyScheme.BEARER,
                    label: formatMessage(integrationMessages.apiKeySchemeBearer),
                  },
                  {
                    value: IntegrationApiKeyScheme.HEADER,
                    label: formatMessage(integrationMessages.apiKeySchemeHeader),
                  },
                ]}
                onValueChange={value => change(setApiKeyScheme)(value as IntegrationApiKeyScheme)}
              />
              {isHeaderScheme ? (
                <Input
                  label={formatMessage(integrationMessages.apiKeyHeaderLabel)}
                  value={apiKeyHeader}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="X-API-Key"
                  error={showError(headerError)}
                  onChange={event => change(setApiKeyHeader)(event.target.value)}
                />
              ) : null}
            </>
          ) : null}
          {integration && !isServerChanged ? (
            <IntegrationTools
              integration={integration}
              isAdministrator={isAdministrator}
            />
          ) : null}
          {isReadOnly ? null : (
            <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4 sm:items-center">
              {integration ? (
                <span className="min-w-0 flex-1">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={<Trash2Icon />}
                    confirm={formatMessage(integrationMessages.deleteConfirm)}
                    onClick={() => onDelete(integration)}
                  >
                    {formatMessage(integrationMessages.delete)}
                  </Button>
                </span>
              ) : null}
              <Button
                type="button"
                variant="transparent"
                onClick={onClose}
              >
                {formatMessage(integrationMessages.cancel)}
              </Button>
              <Button
                type="submit"
                disabled={!isChanged || isSaving}
                icon={isSaving ? <Spinner tone="current" /> : undefined}
              >
                {formatMessage(integration ? integrationMessages.save : integrationMessages.addServer)}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default IntegrationDialog
