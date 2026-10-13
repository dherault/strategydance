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
  // The head commit when it was closed
  closedHeadSha?: string
}

type Options = {
  // The files of `dev`'s head
  files: Files
}

/*
  A repository on GitHub, in memory, for the tests of what publishes the directories' check: its
  branches, its commits' files, its pull requests and their comments, behind the REST calls and the
  one GraphQL mutation the publisher makes, each refusing as GitHub does. A merge is three-way, a
  file at a time, from the commit the branch last took from the other: a file only one side changed
  takes that side's, and one both changed conflicts. `beforeCommit` runs before a commit lands, so a
  test can push in between
*/
function createGitHubFake({ files }: Options) {
  let shas = 0
  const commits = new Map<string, Files>()
  const parents = new Map<string, string[]>()
  const branches = new Map<string, string>()
  const pullRequests: PullRequest[] = []
  const comments = new Map<number, { body: string }[]>()
  const merges: string[] = []
  // The commit of the other branch each branch last took, which a merge compares both sides to
  const mergeBases = new Map<string, string>()
  const state = { beforeCommit: (() => {}) as () => void }

  function createCommit(commitFiles: Files, commitParents: string[] = []) {
    const sha = `sha${++shas}`

    commits.set(sha, commitFiles)
    parents.set(sha, commitParents)

    return sha
  }

  // Every commit a commit comes from, itself included
  function readAncestry(sha: string): Set<string> {
    const ancestry = new Set<string>()
    const queue = [sha]

    while (queue.length) {
      const next = queue.pop()!

      if (ancestry.has(next)) continue

      ancestry.add(next)
      queue.push(...(parents.get(next) ?? []))
    }

    return ancestry
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
        const state = parameters.get('state') ?? 'open'

        return answer(
          200,
          pullRequests
            .filter(pull => pull.state === state && pull.head === head && pull.base === parameters.get('base'))
            .map(pull => ({ ...pull, head: { ref: pull.head, sha: pull.closedHeadSha ?? branches.get(pull.head) } })),
        )
      }

      if (method === 'GET' && (match = route.match(/^\/compare\/(.+)\.\.\.(.+)$/))) {
        const base = readAncestry(branches.get(match[1]) ?? match[1])

        return answer(200, { ahead_by: [...readAncestry(match[2])].filter(sha => !base.has(sha)).length })
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
        const base = commits.get(branches.get(input.base)!)!
        const head = commits.get(branches.get(input.head)!)!
        const start = commits.get(mergeBases.get(input.base)!)!
        const merged: Files = { ...base }

        for (const path of new Set([...Object.keys(base), ...Object.keys(head)])) {
          if (head[path] === start[path] || head[path] === base[path]) continue
          if (base[path] !== start[path]) return answer(409)

          merged[path] = head[path]
        }

        merges.push(input.base)
        mergeBases.set(input.base, branches.get(input.head)!)
        branches.set(input.base, createCommit(merged, [branches.get(input.base)!, branches.get(input.head)!]))

        return answer(201)
      }

      if (method === 'GET' && (match = route.match(/^\/git\/ref\/heads\/(.+)$/))) {
        const sha = branches.get(match[1])

        return sha ? answer(200, { object: { sha } }) : answer(404)
      }

      if (method === 'POST' && route === '/git/refs') {
        const branch = input.ref.replace('refs/heads/', '')

        branches.set(branch, input.sha)
        mergeBases.set(branch, input.sha)

        return answer(201)
      }

      if (method === 'PATCH' && (match = route.match(/^\/git\/refs\/heads\/(.+)$/))) {
        if (!branches.has(match[1])) return answer(422)

        branches.set(match[1], input.sha)
        mergeBases.set(match[1], input.sha)

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

      branches.set(input.branch.branchName, createCommit({ ...commits.get(head)!, ...added }, [head]))

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
      branches.set(
        branch,
        createCommit({ ...commits.get(branches.get(branch)!)!, ...changed }, [branches.get(branch)!]),
      ),
    // A pull request closed without a merge, as a person would
    close: (number: number) => {
      const pull = pullRequests.find(pullRequest => pullRequest.number === number)!

      pull.state = 'closed'
      pull.closedHeadSha = branches.get(pull.head)
    },
  }
}

export default createGitHubFake
