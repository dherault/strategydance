import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import { GITHUB_REPOSITORY } from '~constants'

import useGitHubStargazers from '~hooks/github/useGitHubStargazers'

import navigationMessages from '~data/intl/messages/navigation'

// GitHub's own colours and type, deliberately: the button reads as GitHub's, as its Star button does
const linkClassName = 'inline-flex items-center border border-[#d0d7de] whitespace-nowrap text-[#24292f] no-underline transition-colors duration-[80ms] ease-in-out hover:text-[#24292f] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0969da]'

// The Octicons mark
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

// Invites the reader to star the project, with the count beside it once GitHub has answered
function GitHubStarButton() {
  const { formatMessage, formatNumber } = useIntl()
  const { data: stargazers } = useGitHubStargazers()

  const hasCount = stargazers !== undefined

  return (
    <div className="inline-flex h-7 items-stretch font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Noto_Sans',Helvetica,Arial,sans-serif] text-xs leading-none font-semibold">
      <a
        href={`https://github.com/${GITHUB_REPOSITORY}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={formatMessage(navigationMessages.githubStarLabel, { repository: GITHUB_REPOSITORY })}
        className={cn(linkClassName, 'gap-1.5 bg-[#f6f8fa] px-2.5 hover:bg-[#eaeef2]', hasCount ? 'rounded-l-md' : 'rounded-md')}
      >
        <GitHubMark />
        {formatMessage(navigationMessages.githubStar)}
      </a>
      {hasCount
        ? (
            <a
              href={`https://github.com/${GITHUB_REPOSITORY}/stargazers`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatMessage(navigationMessages.githubStargazers, { count: stargazers })}
              className={cn(linkClassName, '-ml-px rounded-r-md bg-white px-2.5 hover:text-[#0969da]')}
            >
              {formatNumber(stargazers, { notation: 'compact' })}
            </a>
          )
        : null}
    </div>
  )
}

export default GitHubStarButton
