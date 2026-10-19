import express, { type Request, type Response, Router } from 'express'
import {
  type ApiResponse,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_DOCUMENT_REVISION_UNRESTORABLE,
  ERROR_CODE_NOT_FOUND,
  type RestoreDocumentRevisionData,
  type UndoableDocumentRevisionsData,
} from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import knowledgeRevisionRateLimitMiddleware from '~middleware/knowledgeRevisionRateLimit'
import organizationMemberMiddleware from '~middleware/organizationMember'
import validateMiddleware from '~middleware/validate'

import listUndoableKnowledgeDocumentRevisions from '~domain/knowledge/listUndoableKnowledgeDocumentRevisions'
import restoreKnowledgeDocumentRevision from '~domain/knowledge/restoreKnowledgeDocumentRevision'

/*
  An organization's knowledge as the backend serves it to members, for what a page cannot do with
  the web connector alone: the revisions of the agents' edits, whose text only the backend merges
  and writes back as a difference. Mounted at `/organizations/:organizationId/knowledge`, so every
  route reads the organization from the path, and every one is a member's
*/
function createKnowledgeRouter() {
  const router = Router({ mergeParams: true })

  /* ---
    REVISIONS
  --- */

  const undoableParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    conversationId: z.string().regex(UUID_PATTERN),
  })

  type UndoableRequest = Request<z.infer<typeof undoableParamsSchema>, ApiResponse<UndoableDocumentRevisionsData>>

  /*
    The edits one of the caller's conversations made to documents that an Undo can still take back,
    nobody having written to their document since, for the thread to offer Undo on their rows. A
    conversation that is not the caller's, a subagent's included, has none of theirs, and answers
    an empty list
  */
  router.get(
    '/revisions/undoable/:conversationId',
    appCheckMiddleware,
    authenticationMiddleware,
    knowledgeRevisionRateLimitMiddleware,
    validateMiddleware({ params: undoableParamsSchema }),
    organizationMemberMiddleware,
    async (request: UndoableRequest, response: Response<ApiResponse<UndoableDocumentRevisionsData>>) => {
      const revisions = await listUndoableKnowledgeDocumentRevisions({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
      })

      response.json({ status: 'success', data: { revisions } })
    },
  )

  const restoreParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    documentId: z.string().regex(UUID_PATTERN),
    revisionId: z.string().regex(UUID_PATTERN),
  })

  const restoreBodySchema = z.object({
    // An Undo from a tool call's row, which goes back only while nobody has written since the edit
    isUndo: z.boolean(),
  })

  type RestoreRequest = Request<
    z.infer<typeof restoreParamsSchema>,
    ApiResponse<RestoreDocumentRevisionData>,
    z.infer<typeof restoreBodySchema>
  >

  /*
    Goes back to a version of a document, the text it held before an agent's edit or a restore,
    written back as a new edit on the text as it stands, merged with whatever is typed meanwhile,
    and kept as a revision of its own, whose id it answers. Any member may, as any member writes the
    documents, whatever the team lets agents do with them.

    An Undo is refused with a 409 once somebody wrote to the document since the edit; a restore from
    the history takes what was written since with it. A version that cannot be written back as the
    document stands, too long once restored or holding what this release cannot read, is refused
    with a 409 of its own, and a revision pruned or a document deleted with a 404. Sent again, it
    finds the text as the version left it and answers that nothing was written
  */
  router.post(
    '/:documentId/revisions/:revisionId/restore',
    express.json({ limit: '1kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    knowledgeRevisionRateLimitMiddleware,
    validateMiddleware({ params: restoreParamsSchema, body: restoreBodySchema }),
    organizationMemberMiddleware,
    async (request: RestoreRequest, response: Response<ApiResponse<RestoreDocumentRevisionData>>) => {
      const result = await restoreKnowledgeDocumentRevision({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        documentId: toCanonicalUuid(request.params.documentId),
        revisionId: toCanonicalUuid(request.params.revisionId),
        isUndo: request.body.isUndo,
      })

      switch (result.outcome) {
        case 'notFound':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This version of the document is gone')

          return
        case 'changed':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'Somebody wrote to the document since this edit')

          return
        case 'unrestorable':
          respondError(
            response,
            409,
            ERROR_CODE_DOCUMENT_REVISION_UNRESTORABLE,
            'This version cannot be written back as the document stands',
          )

          return
        case 'unchanged':
          response.json({ status: 'success', data: { revisionId: null } })

          return
        case 'restored':
          response.json({ status: 'success', data: { revisionId: result.revisionId } })
      }
    },
  )

  return router
}

export default createKnowledgeRouter
