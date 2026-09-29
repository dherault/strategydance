import type { Preview } from '@storybook/react-vite'

import '../src/index.css'

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      // The sidebar by title rather than in the order the files load, which puts the newest last.
      // A component's own stories keep the order its file declares them in
      storySort: {
        method: 'alphabetical',
      },
    },
  },
}

export default preview
