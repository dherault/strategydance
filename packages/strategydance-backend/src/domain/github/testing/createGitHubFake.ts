import type { GitHubClient } from '~types'

import { GitHubError } from '~domain/github/createGitHubClient'

type Files = Record<string, string>

type PullRequest = {
  number: number
  html_url: string
  body: string
  state: 'open' | 'closed'
  head: string
  base: string
}

type Options = {
  // The files of `dev`'s head
  files: Files
  // Whether merging `dev` into another branch conflicts
  isMergeConflicting?: boolean
}

/*
  A repository on GitHub, in memory, for the tests of what publishes the directories' check: its
  branches, its commits' files, its pull requests and their comments, behind the REST calls and the
  one GraphQL mutation the publisher makes, each refusing as GitHub does. `beforeCommit` runs before
  a commit lands, so a test can push in between
*/
function createGitHubFake({ files, isMergeConflicting = false }: Options) {
  let shas = 0
  const commits = new Map<string, Files>()
  const branches = new Map<string, string>()
  const pullRequests: PullRequest[] = []
  const comments = new Map<number, { body: string }[]>()
  const merges: string[] = []
  const state = { beforeCommit: (() => {}) as () => void }

  function createCommit(commitFiles: Files) {
    const sha = `sha${++shas}`

    commits.set(sha, commitFiles)

    return sha
  }

  branches.set('dev', createCommit(files))

  function fail(method: string, path: string, status: number): never {
    throw new GitHubError(`GitHub answered ${method} ${path} with ${status}`, status)
  }

  const client: GitHubClient = {
    async request(method, path, { body, allowedStatuses = [] } = {}) {
      const input = body as Record<string, string>
      const answer = (status: number, data: unknown = null) =>
        status >= 400 && !allowedStatuses.includes(status) ? fail(method, path, status) : { status, data }
      const [route, query = ''] = path.replace(/^\/repos\/[^/]+\/[^/]+/, '').split('?')
      const parameters = new URLSearchParams(query)
      let match: RegExpMatchArray | null

      if (method === 'GET' && route === '/pulls') {
        const head = parameters.get('head')?.split(':')[1]

        return answer(
          200,
          pullRequests.filter(
            pull => pull.state === 'open' && pull.head === head && pull.base === parameters.get('base'),
          ),
        )
      }

      if (method === 'POST' && route === '/pulls') {
        const pull: PullRequest = {
          number: pullRequests.length + 1,
          html_url: `https://github.com/pull/${pullRequests.length + 1}`,
          body: input.body,
          state: 'open',
          head: input.head,
          base: input.base,
        }

        pullRequests.push(pull)

        return answer(201, pull)
      }

      if (method === 'PATCH' && (match = route.match(/^\/pulls\/(\d+)$/))) {
        const pull = pullRequests.find(({ number }) => number === Number(match![1]))!

        pull.body = input.body

        return answer(200, pull)
      }

      if (method === 'POST' && route === '/merges') {
        if (isMergeConflicting) return answer(409)

        merges.push(input.base)
        branches.set(input.base, createCommit({ ...commits.get(branches.get(input.base)!)! }))

        return answer(201)
      }

      if (method === 'GET' && (match = route.match(/^\/git\/ref\/heads\/(.+)$/))) {
        const sha = branches.get(match[1])

        return sha ? answer(200, { object: { sha } }) : answer(404)
      }

      if (method === 'POST' && route === '/git/refs') {
        branches.set(input.ref.replace('refs/heads/', ''), input.sha)

        return answer(201)
      }

      if (method === 'PATCH' && (match = route.match(/^\/git\/refs\/heads\/(.+)$/))) {
        if (!branches.has(match[1])) return answer(422)

        branches.set(match[1], input.sha)

        return answer(200)
      }

      if (method === 'GET' && (match = route.match(/^\/contents\/(.+)$/))) {
        const text = commits.get(parameters.get('ref')!)?.[match[1]]

        return text === undefined ? answer(404) : answer(200, text)
      }

      if ((match = route.match(/^\/issues\/(\d+)\/comments$/))) {
        const number = Number(match[1])
        const list = comments.get(number) ?? []

        if (method === 'GET') return answer(200, list)

        comments.set(number, [...list, { body: input.body }])

        return answer(201)
      }

      throw new Error(`The fake has no route for ${method} ${path}`)
    },

    async graphql(_query, variables) {
      const { input } = variables as {
        input: {
          branch: { branchName: string }
          expectedHeadOid: string
          fileChanges: { additions: { path: string; contents: string }[] }
        }
      }

      state.beforeCommit()

      const head = branches.get(input.branch.branchName)

      if (head !== input.expectedHeadOid)
        throw new GitHubError(`Expected branch to point to "${input.expectedHeadOid}"`, 200)

      const added = Object.fromEntries(
        input.fileChanges.additions.map(({ path, contents }) => [path, Buffer.from(contents, 'base64').toString()]),
      )

      branches.set(input.branch.branchName, createCommit({ ...commits.get(head)!, ...added }))

      return { createCommitOnBranch: { commit: { oid: branches.get(input.branch.branchName) } } } as never
    },
  }

  return {
    client,
    branches,
    pullRequests,
    comments,
    merges,
    state,
    // The files at a branch's head
    readFiles: (branch: string) => commits.get(branches.get(branch)!)!,
    // A commit pushed onto a branch, as somebody else would
    push: (branch: string, changed: Files) =>
      branches.set(branch, createCommit({ ...commits.get(branches.get(branch)!)!, ...changed })),
  }
}

export default createGitHubFake
