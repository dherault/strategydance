# strategydance-emails

The emails' conventions, beside the root `CLAUDE.md`. Each `renderXEmail` takes props and answers
`{ senderName, subject, html, text }`: delivery is the backend's.

- Everything comes from the one `react-email` package
- `src/emails/` holds templates alone, since the preview takes every file there for one, each
  setting its `PreviewProps`. Shared pieces go in `src/components/`
- Styles are inline objects alone, since Gmail and Outlook strip `<style>` and know no CSS variable:
  the design system's tokens are copied into `src/constants.ts` as literals. The one `<style>` is
  `EmailLayout`'s font face, and react-email's `Font` is not used
- Images are hotlinked PNGs at an absolute production address, from the web's
  `public/assets/images/`, since neither client draws an SVG or a `data:` URI. A new one shows
  broken until a release deploys it
- The backend's `tsc` follows its import into these files, so both `tsconfig.json`s take `"jsx":
  "react-jsx"` and agree on their other options
- English only for now
- Read `scripts/devEmails.sh`'s header before changing how `bun run dev:emails` runs. The preview is
  indicative: check a real client before trusting a layout change
