import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const STAGE = process.env.STAGE || 'offline';
const isLocal = process.env.IS_OFFLINE === 'true';

const client = new DynamoDBClient(
  isLocal
    ? {
        region: 'us-east-1',
        endpoint: 'http://localhost:8000',
        credentials: {
          accessKeyId: 'dummy',
          secretAccessKey: 'dummy',
        },
      }
    : { region: 'us-east-1' }
);

const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  WRESTLERS: `universe-tracker-api-wrestlers-${STAGE}`,
  MATCHES: `universe-tracker-api-matches-${STAGE}`,
  CHAMPIONSHIPS: `universe-tracker-api-championships-${STAGE}`,
  CHAMPIONSHIP_HISTORY: `universe-tracker-api-championship-history-${STAGE}`,
  TOURNAMENTS: `universe-tracker-api-tournaments-${STAGE}`,
  SEASONS: `universe-tracker-api-seasons-${STAGE}`,
  SEASON_STANDINGS: `universe-tracker-api-season-standings-${STAGE}`,
  DIVISIONS: `universe-tracker-api-divisions-${STAGE}`,
  EVENTS: `universe-tracker-api-events-${STAGE}`,
  CONTENDER_RANKINGS: `universe-tracker-api-contender-rankings-${STAGE}`,
  RANKING_HISTORY: `universe-tracker-api-ranking-history-${STAGE}`,
  SITE_CONFIG: `universe-tracker-api-site-config-${STAGE}`,
};

const wrestlerNames = [
  'Stone Cold Steve Austin',
  'The Rock',
  'The Undertaker',
  'Triple H',
  'Shawn Michaels',
  'Bret Hart',
  'John Cena',
  'Randy Orton',
  'Edge',
  'CM Punk',
  'Roman Reigns',
  'Seth Rollins',
];

const stipulations = ['Standard', 'No DQ', 'Steel Cage', 'Ladder Match', 'Hell in a Cell', 'Tables Match'];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function getISOWeekKey(championshipId: string, date: Date): string {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${championshipId}#${year}-${String(week).padStart(2, '0')}`;
}

async function putItem(tableName: string, item: Record<string, unknown>) {
  try {
    await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Failed to put item in ${tableName}:`, message);
    console.error('  Item keys:', JSON.stringify(Object.keys(item)));
    throw err;
  }
}

async function seedData() {
  console.log('Starting to seed data...\n');
  const now = new Date().toISOString();

  // ── Divisions ──────────────────────────────────────────────
  console.log('Creating divisions...');
  const divisions = [
    {
      divisionId: uuidv4(),
      name: 'Raw',
      description: 'The flagship Monday Night Raw roster',
      createdAt: now,
      updatedAt: now,
    },
    {
      divisionId: uuidv4(),
      name: 'SmackDown',
      description: 'The Friday Night SmackDown roster',
      createdAt: now,
      updatedAt: now,
    },
    {
      divisionId: uuidv4(),
      name: 'NXT',
      description: 'The developmental brand for rising stars',
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const division of divisions) {
    await putItem(TABLES.DIVISIONS, division);
    console.log(`  ✓ Division: ${division.name}`);
  }

  // ── Wrestlers ─────────────────────────────────────────────
  console.log('\nCreating wrestlers...');
  const seedWrestlers = wrestlerNames.map((name, index) => ({
    wrestlerId: uuidv4(),
    name,
    wins: Math.floor(Math.random() * 15) + 3,
    losses: Math.floor(Math.random() * 12) + 2,
    draws: Math.floor(Math.random() * 3),
    divisionId: divisions[index % divisions.length].divisionId,
    createdAt: now,
    updatedAt: now,
  }));

  for (const wrestler of seedWrestlers) {
    await putItem(TABLES.WRESTLERS, wrestler);
    console.log(`  ✓ Wrestler: ${wrestler.name} [${divisions.find(d => d.divisionId === wrestler.divisionId)!.name}]`);
  }

  // ── Seasons ────────────────────────────────────────────────
  console.log('\nCreating seasons...');
  const season = {
    seasonId: uuidv4(),
    name: 'Season 1',
    startDate: daysAgo(30).toISOString(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await putItem(TABLES.SEASONS, season);
  console.log(`  ✓ Season: ${season.name}`);

  // ── Season Standings ───────────────────────────────────────
  console.log('\nCreating season standings...');
  for (const wrestler of seedWrestlers) {
    const standing = {
      seasonId: season.seasonId,
      wrestlerId: wrestler.wrestlerId,
      wins: Math.floor(Math.random() * 8) + 1,
      losses: Math.floor(Math.random() * 6) + 1,
      draws: Math.floor(Math.random() * 2),
      updatedAt: now,
    };
    await putItem(TABLES.SEASON_STANDINGS, standing);
    console.log(`  ✓ Standing: ${wrestler.name} (${standing.wins}W-${standing.losses}L-${standing.draws}D)`);
  }

  // ── Championships ──────────────────────────────────────────
  console.log('\nCreating championships...');
  const championships = [
    {
      championshipId: uuidv4(),
      name: 'World Heavyweight Championship',
      type: 'singles',
      currentChampion: seedWrestlers[0].wrestlerId,
      divisionId: divisions[0].divisionId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      championshipId: uuidv4(),
      name: 'Intercontinental Championship',
      type: 'singles',
      currentChampion: seedWrestlers[1].wrestlerId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      championshipId: uuidv4(),
      name: 'Tag Team Championship',
      type: 'tag',
      currentChampion: [seedWrestlers[2].wrestlerId, seedWrestlers[3].wrestlerId],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      championshipId: uuidv4(),
      name: 'United States Championship',
      type: 'singles',
      currentChampion: seedWrestlers[4].wrestlerId,
      divisionId: divisions[1].divisionId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];

  for (const championship of championships) {
    await putItem(TABLES.CHAMPIONSHIPS, championship);
    console.log(`  ✓ Championship: ${championship.name}`);
  }

  // ── Championship History ───────────────────────────────────
  console.log('\nCreating championship history...');
  for (let i = 0; i < championships.length; i++) {
    const wonDate = daysAgo(30 - i * 5);
    const historyItem: Record<string, unknown> = {
      championshipId: championships[i].championshipId,
      wonDate: wonDate.toISOString(),
      champion: championships[i].currentChampion,
      matchId: uuidv4(),
      defenses: Math.floor(Math.random() * 4),
    };
    await putItem(TABLES.CHAMPIONSHIP_HISTORY, historyItem);
    console.log(`  ✓ History: ${championships[i].name}`);
  }

  // ── Matches ────────────────────────────────────────────────
  console.log('\nCreating matches...');
  const matches: Record<string, unknown>[] = [];

  // Past completed matches
  for (let i = 0; i < 8; i++) {
    const ago = Math.floor(Math.random() * 25) + 5;
    const matchDate = daysAgo(ago);

    const p1 = seedWrestlers[Math.floor(Math.random() * seedWrestlers.length)];
    let p2 = seedWrestlers[Math.floor(Math.random() * seedWrestlers.length)];
    while (p2.wrestlerId === p1.wrestlerId) {
      p2 = seedWrestlers[Math.floor(Math.random() * seedWrestlers.length)];
    }

    const winner = Math.random() > 0.5 ? p1 : p2;
    const loser = winner === p1 ? p2 : p1;

    matches.push({
      matchId: uuidv4(),
      date: matchDate.toISOString(),
      matchType: 'singles',
      stipulation: stipulations[Math.floor(Math.random() * stipulations.length)],
      participants: [p1.wrestlerId, p2.wrestlerId],
      winners: [winner.wrestlerId],
      losers: [loser.wrestlerId],
      isChampionship: false,
      seasonId: season.seasonId,
      status: 'completed',
      createdAt: now,
      version: 1,
    });
  }

  // Future scheduled matches
  for (let i = 0; i < 4; i++) {
    const ahead = Math.floor(Math.random() * 14) + 1;
    const matchDate = daysFromNow(ahead);

    const p1 = seedWrestlers[Math.floor(Math.random() * seedWrestlers.length)];
    let p2 = seedWrestlers[Math.floor(Math.random() * seedWrestlers.length)];
    while (p2.wrestlerId === p1.wrestlerId) {
      p2 = seedWrestlers[Math.floor(Math.random() * seedWrestlers.length)];
    }

    const match: Record<string, unknown> = {
      matchId: uuidv4(),
      date: matchDate.toISOString(),
      matchType: i % 2 === 0 ? 'singles' : 'tag',
      stipulation: stipulations[Math.floor(Math.random() * stipulations.length)],
      participants: [p1.wrestlerId, p2.wrestlerId],
      isChampionship: i === 0,
      seasonId: season.seasonId,
      status: 'scheduled',
      createdAt: now,
      version: 1,
    };

    if (i === 0) {
      match.championshipId = championships[0].championshipId;
    }

    matches.push(match);
  }

  for (const match of matches) {
    await putItem(TABLES.MATCHES, match);
    console.log(`  ✓ Match: ${match.matchType} (${match.status})`);
  }

  // ── Tournaments ────────────────────────────────────────────
  console.log('\nCreating tournaments...');
  const tournaments = [
    {
      tournamentId: uuidv4(),
      name: 'King of the Ring 2024',
      type: 'single-elimination',
      status: 'in-progress',
      participants: [seedWrestlers[0].wrestlerId, seedWrestlers[1].wrestlerId, seedWrestlers[2].wrestlerId, seedWrestlers[3].wrestlerId],
      brackets: {
        rounds: [
          {
            roundNumber: 1,
            matches: [
              {
                participant1: seedWrestlers[0].wrestlerId,
                participant2: seedWrestlers[1].wrestlerId,
                winner: seedWrestlers[0].wrestlerId,
              },
              {
                participant1: seedWrestlers[2].wrestlerId,
                participant2: seedWrestlers[3].wrestlerId,
                winner: seedWrestlers[2].wrestlerId,
              },
            ],
          },
          {
            roundNumber: 2,
            matches: [
              {
                participant1: seedWrestlers[0].wrestlerId,
                participant2: seedWrestlers[2].wrestlerId,
              },
            ],
          },
        ],
      },
      createdAt: now,
      version: 1,
    },
    {
      tournamentId: uuidv4(),
      name: 'G1 Climax 2024',
      type: 'round-robin',
      status: 'in-progress',
      participants: [seedWrestlers[4].wrestlerId, seedWrestlers[5].wrestlerId, seedWrestlers[6].wrestlerId, seedWrestlers[7].wrestlerId],
      standings: {
        [seedWrestlers[4].wrestlerId]: { wins: 2, losses: 1, draws: 0, points: 4 },
        [seedWrestlers[5].wrestlerId]: { wins: 2, losses: 1, draws: 0, points: 4 },
        [seedWrestlers[6].wrestlerId]: { wins: 1, losses: 2, draws: 0, points: 2 },
        [seedWrestlers[7].wrestlerId]: { wins: 1, losses: 2, draws: 0, points: 2 },
      },
      createdAt: now,
      version: 1,
    },
  ];

  for (const tournament of tournaments) {
    await putItem(TABLES.TOURNAMENTS, tournament);
    console.log(`  ✓ Tournament: ${tournament.name}`);
  }

  // ── Events ─────────────────────────────────────────────────
  console.log('\nCreating events...');
  const completedMatches = matches.filter(m => m.status === 'completed');
  const scheduledMatches = matches.filter(m => m.status === 'scheduled');

  const events = [
    {
      eventId: uuidv4(),
      name: 'WrestleMania 40',
      eventType: 'ppv',
      date: daysFromNow(14).toISOString(),
      venue: 'MetLife Stadium',
      description: 'The Showcase of the Immortals',
      themeColor: '#FFD700',
      status: 'upcoming',
      seasonId: season.seasonId,
      fantasyEnabled: true,
      matchCards: scheduledMatches.slice(0, 3).map((m, idx) => {
        const card: Record<string, unknown> = {
          position: idx + 1,
          matchId: m.matchId as string,
          designation: idx === 0 ? 'opener' : idx === 2 ? 'main-event' : 'midcard',
        };
        if (m.isChampionship) {
          card.notes = 'Championship Match';
        }
        return card;
      }),
      createdAt: now,
      updatedAt: now,
    },
    {
      eventId: uuidv4(),
      name: 'Monday Night Raw #1580',
      eventType: 'weekly',
      date: daysAgo(7).toISOString(),
      description: 'The longest running weekly episodic television show',
      status: 'completed',
      seasonId: season.seasonId,
      fantasyEnabled: true,
      matchCards: completedMatches.slice(0, 3).map((m, idx) => ({
        position: idx + 1,
        matchId: m.matchId as string,
        designation: idx === 0 ? 'opener' : idx === 2 ? 'main-event' : 'midcard',
      })),
      createdAt: now,
      updatedAt: now,
    },
    {
      eventId: uuidv4(),
      name: 'Royal Rumble 2026',
      eventType: 'ppv',
      date: daysFromNow(30).toISOString(),
      venue: 'Alamodome',
      description: 'Every man for himself',
      themeColor: '#1E90FF',
      status: 'upcoming',
      seasonId: season.seasonId,
      fantasyEnabled: true,
      matchCards: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const event of events) {
    await putItem(TABLES.EVENTS, event);
    console.log(`  ✓ Event: ${event.name}`);
  }

  // Link completed matches back to their event
  for (const m of completedMatches.slice(0, 3)) {
    m.eventId = events[1].eventId;
  }
  for (const m of scheduledMatches.slice(0, 3)) {
    m.eventId = events[0].eventId;
  }
  // Re-save matches that now have eventId
  for (const match of [...completedMatches.slice(0, 3), ...scheduledMatches.slice(0, 3)]) {
    await putItem(TABLES.MATCHES, match);
  }
  console.log('  ✓ Linked matches to events');

  // ── Contender Rankings ─────────────────────────────────────
  console.log('\nCreating contender rankings...');
  // Rankings for the World Heavyweight Championship (singles, division-locked to Raw)
  const rawWrestlers = seedWrestlers.filter(w => w.divisionId === divisions[0].divisionId);
  const whcChampionId = championships[0].currentChampion as string;
  const whcContenders = rawWrestlers
    .filter(p => p.wrestlerId !== whcChampionId)
    .slice(0, 3);

  for (let i = 0; i < whcContenders.length; i++) {
    const contender = whcContenders[i];
    const ranking: Record<string, unknown> = {
      championshipId: championships[0].championshipId,
      wrestlerId: contender.wrestlerId,
      rank: i + 1,
      rankingScore: 80 - i * 15,
      winPercentage: 0.6 - i * 0.1,
      currentStreak: 3 - i,
      qualityScore: 70 - i * 10,
      recencyScore: 85 - i * 12,
      matchesInPeriod: 5 + i,
      winsInPeriod: 4 - i,
      peakRank: 1,
      weeksAtTop: i === 0 ? 2 : 0,
      calculatedAt: now,
      updatedAt: now,
    };
    if (i <= 1) {
      ranking.previousRank = i === 0 ? 2 : 1;
    }
    await putItem(TABLES.CONTENDER_RANKINGS, ranking);
    console.log(`  ✓ Ranking: ${contender.name} → #${ranking.rank} for ${championships[0].name}`);
  }

  // Rankings for the Intercontinental Championship (open, no division lock)
  const icChampionId = championships[1].currentChampion as string;
  const icContenders = seedWrestlers
    .filter(p => p.wrestlerId !== icChampionId)
    .slice(0, 5);

  for (let i = 0; i < icContenders.length; i++) {
    const contender = icContenders[i];
    const ranking: Record<string, unknown> = {
      championshipId: championships[1].championshipId,
      wrestlerId: contender.wrestlerId,
      rank: i + 1,
      rankingScore: 90 - i * 12,
      winPercentage: 0.7 - i * 0.08,
      currentStreak: 4 - i,
      qualityScore: 75 - i * 8,
      recencyScore: 88 - i * 10,
      matchesInPeriod: 6 + i,
      winsInPeriod: 5 - i,
      peakRank: Math.max(1, i),
      weeksAtTop: i === 0 ? 3 : 0,
      calculatedAt: now,
      updatedAt: now,
    };
    if (i + 1 <= 3) {
      ranking.previousRank = i + 2;
    }
    await putItem(TABLES.CONTENDER_RANKINGS, ranking);
    console.log(`  ✓ Ranking: ${contender.name} → #${ranking.rank} for ${championships[1].name}`);
  }

  // ── Ranking History ────────────────────────────────────────
  console.log('\nCreating ranking history...');
  // Create 3 weeks of ranking history for top IC contenders
  for (let weekOffset = 0; weekOffset < 3; weekOffset++) {
    const weekDate = daysAgo(weekOffset * 7);
    for (let i = 0; i < 3; i++) {
      const contender = icContenders[i];
      const weekKey = getISOWeekKey(championships[1].championshipId, weekDate);
      const entry = {
        wrestlerId: contender.wrestlerId,
        weekKey,
        championshipId: championships[1].championshipId,
        rank: i + 1 + (weekOffset === 2 ? 1 : 0), // slightly different older ranks
        rankingScore: 90 - i * 12 - weekOffset * 3,
        movement: weekOffset === 0 ? (i === 0 ? 1 : -1) : 0,
        createdAt: weekDate.toISOString(),
      };
      await putItem(TABLES.RANKING_HISTORY, entry);
    }
    console.log(`  ✓ Ranking history: week ${weekOffset + 1}`);
  }

  // ── Site Config ────────────────────────────────────────────
  console.log('\nCreating site config...');
  const siteConfig = {
    configKey: 'features',
    features: {
      contenders: true,
      statistics: true,
    },
    updatedAt: now,
  };

  await putItem(TABLES.SITE_CONFIG, siteConfig);
  console.log('  ✓ Site config: features');

  // ── Summary ────────────────────────────────────────────────
  console.log('\n✅ Seed data created successfully!');
  console.log('\nSummary:');
  console.log(`  - ${divisions.length} divisions`);
  console.log(`  - ${seedWrestlers.length} wrestlers`);
  console.log(`  - 1 season`);
  console.log(`  - ${seedWrestlers.length} season standings`);
  console.log(`  - ${championships.length} championships`);
  console.log(`  - ${championships.length} championship history entries`);
  console.log(`  - ${matches.length} matches (${completedMatches.length} completed, ${scheduledMatches.length} scheduled)`);
  console.log(`  - ${tournaments.length} tournaments`);
  console.log(`  - ${events.length} events`);
  console.log(`  - ${whcContenders.length + icContenders.length} contender rankings`);
  console.log(`  - ${3 * 3} ranking history entries`);
  console.log(`  - 1 site config`);
}

seedData()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error seeding data:', error);
    process.exit(1);
  });
