type RichTextYjs = {
  createRichTextYUpdate: typeof import('strategydance-design-system/lib/createRichTextYUpdate').createRichTextYUpdate
  readRichTextYDoc: typeof import('strategydance-design-system/lib/readRichTextYDoc').readRichTextYDoc
}

// One download for every document page, started by the first that opens, and what it brought
let modulePromise: Promise<RichTextYjs> | null = null
let loaded: RichTextYjs | null = null

/*
  The design system's conversions between stored rich text and a Yjs document, fetched only once a
  document's page asks for them, as its editor is: they carry BlockNote, which stays out of the
  bundle the Today page first paints with. A later page tries again rather than inheriting a
  failed download
*/
function loadRichTextYjs() {
  modulePromise ??= Promise.all([
    import('strategydance-design-system/lib/createRichTextYUpdate'),
    import('strategydance-design-system/lib/readRichTextYDoc'),
  ])
    .then(([{ createRichTextYUpdate }, { readRichTextYDoc }]) => {
      loaded = { createRichTextYUpdate, readRichTextYDoc }

      return loaded
    })
    .catch(error => {
      modulePromise = null

      throw error
    })

  return modulePromise
}

// The conversions once `loadRichTextYjs` has brought them, for what runs only after it has
export function getLoadedRichTextYjs() {
  if (!loaded) throw new Error('The rich text conversions have not loaded yet')

  return loaded
}

export type { RichTextYjs }

export default loadRichTextYjs
