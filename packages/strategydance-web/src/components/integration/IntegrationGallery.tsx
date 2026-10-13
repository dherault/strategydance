import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  EXTERNAL_MCP_SERVERS,
  type ExternalMcpServer,
  ExternalMcpServerCategory,
  findExternalMcpServerByUrl,
} from 'strategydance-external-mcp-servers'

import type { OrganizationIntegration } from '~types'

import getExternalMcpServerCategoryMessage from '~utils/integration/getExternalMcpServerCategoryMessage'

import IntegrationMark from '~components/integration/IntegrationMark'

import externalMcpServerMessages from '~data/intl/messages/externalMcpServer'
import integrationMessages from '~data/intl/messages/integration'

type Props = {
  integrations: OrganizationIntegration[]
  onAdd: (server: ExternalMcpServer) => void
}

/*
  The external MCP servers the organization has not added, as tiles that open the add dialog filled
  in, grouped by what they reach, in the categories' order. A server counts as added once one of the
  organization's servers came from it or sits at its address. Nothing shows once every one is added
*/
function IntegrationGallery({ integrations, onAdd }: Props) {
  const { formatMessage } = useIntl()

  const addedSlugs = new Set(
    integrations.map(({ catalogueSlug, url }) => catalogueSlug ?? findExternalMcpServerByUrl(url)?.slug ?? null),
  )
  const groups = Object.values(ExternalMcpServerCategory)
    .map(category => ({
      category,
      servers: EXTERNAL_MCP_SERVERS.filter(server => server.category === category && !addedSlugs.has(server.slug)),
    }))
    .filter(({ servers }) => servers.length)

  if (!groups.length) return null

  return (
    <section
      aria-labelledby="integration-gallery"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="integration-gallery"
          className="m-0 text-2xl"
        >
          {formatMessage(integrationMessages.galleryTitle)}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">{formatMessage(integrationMessages.galleryDescription)}</p>
      </div>
      {groups.map(({ category, servers }) => (
        <div
          key={category}
          className="flex flex-col gap-3"
        >
          <h3 className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {formatMessage(getExternalMcpServerCategoryMessage(category))}
          </h3>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3 p-0">
            {servers.map(server => (
              <li key={server.slug}>
                <button
                  type="button"
                  aria-label={formatMessage(integrationMessages.addCatalogueServer, { name: server.name })}
                  onClick={() => onAdd(server)}
                  className="group flex h-full w-full cursor-pointer flex-col items-stretch gap-3 rounded-xs border border-neutral-200 bg-white p-4 text-left font-sans transition-colors duration-150 ease-in-out hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  <span className="flex items-center gap-3">
                    <IntegrationMark
                      name={server.name}
                      catalogueSlug={server.slug}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-secondary">{server.name}</span>
                    <PlusIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                    />
                  </span>
                  <span className="text-sm leading-normal text-pretty text-muted-foreground">
                    {formatMessage(externalMcpServerMessages[server.slug])}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default IntegrationGallery
