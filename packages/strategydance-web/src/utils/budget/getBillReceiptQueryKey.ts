// The cache entry of a receipt's file as the page draws it, which names whose read it is: the tab's
// cache outlives a sign-out
function getBillReceiptQueryKey(organizationId: string | null, receiptId: string, viewerId: string | null) {
  return ['BillReceiptFile', organizationId, receiptId, viewerId]
}

export default getBillReceiptQueryKey
