import { TableNames } from '../../lib/dynamodb';

export type ExportDatasetKey =
  | 'divisions'
  | 'wrestlers'
  | 'seasons'
  | 'seasonStandings'
  | 'championships'
  | 'championshipHistory'
  | 'matches'
  | 'tournaments'
  | 'events'
  | 'contenderRankings'
  | 'rankingHistory'
  | 'siteConfig'
  | 'stipulations'
  | 'matchTypes'
  | 'seasonAwards'
  | 'companies'
  | 'shows';

export interface ExportTableConfig {
  key: ExportDatasetKey;
  tableName: string;
  partitionKey: string;
  sortKey?: string;
}

export const EXPORT_SCHEMA_VERSION = 1;

export const EXPORT_TABLES: readonly ExportTableConfig[] = [
  { key: 'divisions', tableName: TableNames.DIVISIONS, partitionKey: 'divisionId' },
  { key: 'wrestlers', tableName: TableNames.WRESTLERS, partitionKey: 'wrestlerId' },
  { key: 'seasons', tableName: TableNames.SEASONS, partitionKey: 'seasonId' },
  { key: 'seasonStandings', tableName: TableNames.SEASON_STANDINGS, partitionKey: 'seasonId', sortKey: 'wrestlerId' },
  { key: 'championships', tableName: TableNames.CHAMPIONSHIPS, partitionKey: 'championshipId' },
  {
    key: 'championshipHistory',
    tableName: TableNames.CHAMPIONSHIP_HISTORY,
    partitionKey: 'championshipId',
    sortKey: 'wonDate',
  },
  { key: 'matches', tableName: TableNames.MATCHES, partitionKey: 'matchId', sortKey: 'date' },
  { key: 'tournaments', tableName: TableNames.TOURNAMENTS, partitionKey: 'tournamentId' },
  { key: 'events', tableName: TableNames.EVENTS, partitionKey: 'eventId' },
  {
    key: 'contenderRankings',
    tableName: TableNames.CONTENDER_RANKINGS,
    partitionKey: 'championshipId',
    sortKey: 'wrestlerId',
  },
  { key: 'rankingHistory', tableName: TableNames.RANKING_HISTORY, partitionKey: 'wrestlerId', sortKey: 'weekKey' },
  { key: 'siteConfig', tableName: TableNames.SITE_CONFIG, partitionKey: 'configKey' },
  { key: 'stipulations', tableName: TableNames.STIPULATIONS, partitionKey: 'stipulationId' },
  { key: 'matchTypes', tableName: TableNames.MATCH_TYPES, partitionKey: 'matchTypeId' },
  { key: 'seasonAwards', tableName: TableNames.SEASON_AWARDS, partitionKey: 'seasonId', sortKey: 'awardId' },
  { key: 'companies', tableName: TableNames.COMPANIES, partitionKey: 'companyId' },
  { key: 'shows', tableName: TableNames.SHOWS, partitionKey: 'showId' },
] as const;

export type ExportData = Record<ExportDatasetKey, Record<string, unknown>[]>;

export interface SeedImportPayload {
  version: number;
  exportedAt: string;
  stage: string;
  data: ExportData;
}
