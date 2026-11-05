/*
  Hands a blob to the browser as a download under a name, through a link clicked out of sight. Its
  address is given back a moment later, once the browser has started reading it
*/
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default saveFile
