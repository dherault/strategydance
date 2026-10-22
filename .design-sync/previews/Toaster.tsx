import * as S from '@ds-stories/packages/strategydance-design-system/src/components/ui/Toaster.stories'
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

// Sonner draws its toasts in a fixed list, which the card's wrapper, transformed, holds instead of the
// viewport, and the wrapper is as tall as the row of triggers: a toast anchored to the bottom then lands
// above the viewport, where nobody sees it. Giving the story a box as tall as the viewport, its body's
// padding taken back as `previews/Sidebar.tsx` does and the card's 24px gutter kept inside the box, lands
// a toast where Storybook's does, in the viewport's corner, and changes nothing at rest
function viewportTall(Story: () => any) {
  return () => (
    <>
      <style>{'body { padding: 0 }'}</style>
      <div style={{ boxSizing: 'border-box', minHeight: '100vh', padding: 24 }}>
        <Story />
      </div>
    </>
  )
}

export const Default = viewportTall(compose(S, 'Default'))
export const RichColors = viewportTall(compose(S, 'RichColors'))
export const CloseButton = viewportTall(compose(S, 'CloseButton'))
export const Expanded = viewportTall(compose(S, 'Expanded'))
