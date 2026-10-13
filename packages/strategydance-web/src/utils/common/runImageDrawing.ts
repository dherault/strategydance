import runInOrder from '~utils/common/runInOrder'

/*
  Runs a drawing of an image, a shrinking or a thumbnail, once every drawing asked for before it
  is done, one at a time across the tab: each decodes its image whole for a moment, an image of
  8000 pixels a side to about 250 MB, so several at once could take a phone's tab
*/
function runImageDrawing<T>(draw: () => Promise<T>) {
  return runInOrder('imageDrawing', draw)
}

export default runImageDrawing
