import { handler as getWrestlersHandler } from './getWrestlers';
import { handler as createWrestlerHandler } from './createWrestler';
import { handler as updateWrestlerHandler } from './updateWrestler';
import { handler as deleteWrestlerHandler } from './deleteWrestler';
import { createRouter, type RouteConfig } from '../../lib/router';
import { handler as getWrestlerStatisticsHandler } from './getWrestlerStatistics';


/**
 * Single Lambda for wrestlers: routes by HTTP method and path.
 * Replaces getWrestlers, createWrestler, updateWrestler, deleteWrestler, getWrestlerStatistics.
 */

const routes: ReadonlyArray<RouteConfig> = [
  {
    resource: '/wrestlers',
    method: 'GET',
    handler: getWrestlersHandler,
  },
  {
    resource: '/wrestlers',
    method: 'POST',
    handler: createWrestlerHandler,
  },
  {
    resource: '/wrestlers/{wrestlerId}/statistics',
    method: 'GET',
    handler: getWrestlerStatisticsHandler,
  },
  {
    resource: '/wrestlers/{wrestlerId}',
    method: 'PUT',
    handler: updateWrestlerHandler,
  },
  {
    resource: '/wrestlers/{wrestlerId}',
    method: 'DELETE',
    handler: deleteWrestlerHandler,
  },
];
export const handler = createRouter(routes);
