import { describe, expect, test } from 'bun:test'

import formatDirectoryCheckReport, { escape } from '~domain/directories/formatDirectoryCheckReport'

const USAGE = { inputTokens: 100_000, cacheCreationInputTokens: 0, cacheReadInputTokens: 50_000, outputTokens: 10_000 }

describe('formatDirectoryCheckReport', () => {
  test('writes a row per directory, the counts, and what the run cost', () => {
    const report = formatDirectoryCheckReport({
      today: '2026-10-20',
      outcomes: [
        {
          name: 'Tools',
          rootUrl: 'https://tools.example/',
          result: 'active',
          changes: ['Description written: “Directory of tools.”', 'Business model FREE → FREE_WITH_BADGE'],
          evidence: { quote: 'Free with our badge', url: 'https://tools.example/faq' },
          notes: 'The FAQ says so.',
        },
        {
          name: 'Gone',
          rootUrl: 'https://gone.example/',
          result: 'unreachable',
          changes: [],
          evidence: null,
          notes: 'Unreachable: ENOTFOUND',
        },
      ],
      skipped: ['Late'],
      usage: USAGE,
    })

    expect(report).toBe(
      [
        '### 2026-10-20',
        '',
        'Checked 2 directories: active 1, unreachable 1.',
        '',
        '| Directory | Result | Changes | Notes |',
        '| --- | --- | --- | --- |',
        '| [Tools](https://tools.example/) | Active | Description written: “Directory of tools.”<br>Business model FREE → FREE\\_WITH\\_BADGE<br>Quote: “Free with our badge”, [source](https://tools.example/faq) | The FAQ says so. |',
        '| [Gone](https://gone.example/) | Unreachable | - | Unreachable: ENOTFOUND |',
        '',
        'Out of time before: Late.',
        '',
        'Claude: 150,000 input tokens (50,000 read from the cache), 10,000 output tokens, about $0.61.',
      ].join('\n'),
    )
  })
})

describe('escape', () => {
  test('keeps what a page wrote from breaking the table, linking or notifying anybody', () => {
    expect(escape('a | b\nc <script> [x](y) @david #123 *bold*')).toBe(
      'a \\| b c \\<script\\> \\[x\\](y) @​david #​123 \\*bold\\*',
    )
  })
})
