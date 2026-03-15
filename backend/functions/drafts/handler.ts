import { handler as getDraftsHandler } from './getDrafts';
import { handler as getDraftHandler } from './getDraft';
import { handler as createDraftHandler } from './createDraft';
import { handler as updateDraftHandler } from './updateDraft';
import { handler as deleteDraftHandler } from './deleteDraft';
import { handler as startDraftHandler } from './startDraft';
import { handler as makePickHandler } from './makePick';
import { handler as protectWrestlerHandler } from './protectWrestler';
import { handler as completeDraftHandler } from './completeDraft';
import { createRouter, RouteConfig } from '../../lib/router';

const routes: ReadonlyArray<RouteConfig> = [
  {
    resource: '/drafts',
    method: 'GET',
    handler: getDraftsHandler,
  },
  {
    resource: '/drafts',
    method: 'POST',
    handler: createDraftHandler,
  },
  {
    resource: '/drafts/{draftId}',
    method: 'GET',
    handler: getDraftHandler,
  },
  {
    resource: '/drafts/{draftId}',
    method: 'PUT',
    handler: updateDraftHandler,
  },
  {
    resource: '/drafts/{draftId}',
    method: 'DELETE',
    handler: deleteDraftHandler,
  },
  {
    resource: '/drafts/{draftId}/start',
    method: 'POST',
    handler: startDraftHandler,
  },
  {
    resource: '/drafts/{draftId}/pick',
    method: 'POST',
    handler: makePickHandler,
  },
  {
    resource: '/drafts/{draftId}/protect',
    method: 'POST',
    handler: protectWrestlerHandler,
  },
  {
    resource: '/drafts/{draftId}/complete',
    method: 'POST',
    handler: completeDraftHandler,
  },
];

export const handler = createRouter(routes);
