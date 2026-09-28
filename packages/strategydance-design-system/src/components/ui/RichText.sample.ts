// A post using every node and format the editor writes, shared by the stories and the tests
const richTextSample = JSON.stringify({
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: [
          { type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: 'Task feed p95 is down from 410ms to 230ms. Two indexes on ' },
          { type: 'text', version: 1, detail: 0, format: 1, mode: 'normal', style: '', text: 'task_assignments' },
          { type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: ' did most of the work.' },
        ],
      },
      {
        type: 'heading',
        version: 1,
        tag: 'h2',
        direction: null,
        format: '',
        indent: 0,
        children: [
          { type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: 'Left to reach 200ms' },
        ],
      },
      {
        type: 'list',
        version: 1,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        direction: null,
        format: '',
        indent: 0,
        children: [
          {
            type: 'listitem',
            version: 1,
            value: 1,
            direction: null,
            format: '',
            indent: 0,
            children: [
              { type: 'text', version: 1, detail: 0, format: 2, mode: 'normal', style: '', text: 'Remove the N+1 query on comments' },
            ],
          },
          {
            type: 'listitem',
            version: 1,
            value: 2,
            direction: null,
            format: '',
            indent: 0,
            children: [
              { type: 'text', version: 1, detail: 0, format: 12, mode: 'normal', style: '', text: 'Cache org settings per request' },
            ],
          },
        ],
      },
      {
        type: 'quote',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [
          { type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: 'This is the first one the whole team opens every morning.' },
        ],
      },
    ],
  },
})

export default richTextSample
