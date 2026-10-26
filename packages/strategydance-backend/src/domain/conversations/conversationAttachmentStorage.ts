import createBucketStorage, { type BucketStorage } from '~utils/createBucketStorage'

// The bucket as the conversations' files and their tests' fake see it
export type AttachmentStorage = BucketStorage

/*
  Where the files sent in conversations are kept, the bucket's `pending/` and conversations'
  folders, and the one module that touches them, so the tests stand a fake in for it. Every object is
  written create-only, since every replay of a conversation depends on its bytes never changing
*/
const conversationAttachmentStorage = createBucketStorage()

export default conversationAttachmentStorage
