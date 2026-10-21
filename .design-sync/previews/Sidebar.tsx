import * as S from '@ds-stories/packages/strategydance-design-system/src/components/ui/Sidebar.stories'
import * as React from 'react'

function compose(S: any, key: string) {
  const meta: any = S.default ?? {}
  const st: any = S[key]
  const args: any = { ...meta.args, ...(st && st.args ? st.args : {}) }
  // Storybook resolves argTypes.mapping (control value -> real arg) before
  // rendering; mirror that so mapped args don't render raw.
  const at: any = { ...meta.argTypes, ...(st && st.argTypes ? st.argTypes : {}) }
  for (const k of Object.keys(args)) {
    const m = at[k] && at[k].mapping
    if (m && typeof m === 'object' && args[k] in m) args[k] = m[args[k]]
  }
  const title: string = typeof meta.title === 'string' ? meta.title : ''
  const ctx: any = {
    args,
    name: key,
    title,
    kind: title,
    id: '',
    componentId: '',
    globals: {},
    viewMode: 'story',
    parameters: (st && st.parameters) ?? meta.parameters ?? {},
  }
  let render: (() => any) | null = null
  if (st && typeof st.render === 'function') render = () => st.render(args, ctx)
  else if (typeof st === 'function') render = () => st(args, ctx)
  else if (typeof meta.render === 'function') render = () => meta.render(args, ctx)
  else {
    const C = (st && st.component) || meta.component
    if (C) render = () => React.createElement(C, args)
  }
  if (!render) return () => null
  // [].concat: a single function is legal CSF decorator shorthand. A
  // decorator returning undefined (stubbed addon) falls through to the inner
  // render — otherwise one unrecognized addon blanks the cell silently.
  const decorators: any[] = ([] as any[]).concat((st && st.decorators) ?? []).concat(meta.decorators ?? [])
  return decorators.reduce(
    (inner: any, dec: any) => () => {
      const out = dec(inner, ctx)
      return out === undefined ? inner() : out
    },
    render,
  )
}

// Storybook draws these stories fullscreen (`parameters.layout`), with nothing around them, and the
// card pads its body by 24px. Taking the padding back on the body itself, as Storybook's fullscreen
// layout does, keeps the sidebar's fixed panel, which the card's wrapper contains, at the edge, and
// the sidebar, as tall as the viewport, ending where the viewport does, its footer in view
function fullscreen(Story: () => any) {
  return () => (
    <>
      <style>{'body { padding: 0 }'}</style>
      <Story />
    </>
  )
}

export const Default = fullscreen(compose(S, 'Default'))
export const Collapsed = fullscreen(compose(S, 'Collapsed'))
export const Loading = fullscreen(compose(S, 'Loading'))
