import { BillReceiptStatus, getBillReceiptForMember } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'

type BillReceiptLocation = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  receiptId: string
}

type ReadBillReceiptResult =
  | { outcome: 'found'; objectName: string; name: string; contentType: string; size: number }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  | { outcome: 'missing' }

/*
  Where a bill's receipt is kept, for the route that serves its bytes: to any member of its
  organization, whoever uploaded it and whether or not they are still a member, once it is stored.
  The membership is read with it on every read, which a Storage rule could not do: it would know only
  the uid, which a member removed keeps
*/
async function readBillReceipt(location: BillReceiptLocation): Promise<ReadBillReceiptResult> {
  const { data } = await getBillReceiptForMember(dataConnect, location)
  const receipt = data.billReceipt

  if (!data.userOrganization) return { outcome: 'forbidden' }

  if (!receipt || receipt.organizationId !== location.organizationId || receipt.status !== BillReceiptStatus.READY) {
    return { outcome: 'missing' }
  }

  return {
    outcome: 'found',
    objectName: buildBillReceiptObjectName(location),
    name: receipt.name,
    contentType: receipt.contentType,
    size: receipt.size,
  }
}

export default readBillReceipt
