import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWrestlerStats } from '../../hooks/useWrestlerStats';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import WrestlerStatsContent from './WrestlerStatsContent';
import SeasonSelector from './SeasonSelector';
import './WrestlerStats.css';

interface EmbeddedWrestlerStatsProps {
  wrestlerId: string;
}

function EmbeddedWrestlerStats({ wrestlerId }: EmbeddedWrestlerStatsProps) {
  const { t } = useTranslation();

  const {
    data, loading, error, seasons, selectedSeasonId, setSelectedSeasonId,
    overallStats, matchTypeStats, championshipStats, achievements,
  } = useWrestlerStats({ wrestlerId });

  const wrestler = useMemo(
    () => data?.wrestlers?.find((p) => p.wrestlerId === wrestlerId),
    [data, wrestlerId]
  );

  if (loading && !overallStats) {
    return (
      <div className="wrestler-stats">
        <Skeleton variant="block" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrestler-stats">
        <p>{error}</p>
      </div>
    );
  }

  if (!wrestler || !overallStats) {
    return (
      <div className="wrestler-stats">
        <EmptyState
          title={t('statistics.wrestlerStats.title')}
          description={t('statistics.wrestlerStats.noData')}
        />
      </div>
    );
  }

  return (
    <div className="wrestler-stats">
      <div className="ps-nav-links">
        <Link to="/stats/head-to-head">{t('statistics.nav.headToHead')}</Link>
        <Link to="/stats/leaderboards">{t('statistics.nav.leaderboards')}</Link>
        <Link to="/stats/match-types">{t('statistics.nav.matchTypeLeaderboards')}</Link>
        <Link to="/stats/rivalries">{t('statistics.nav.rivalries')}</Link>
        <Link to="/stats/tale-of-tape">{t('statistics.nav.taleOfTape')}</Link>
        <Link to="/stats/records">{t('statistics.nav.records')}</Link>
        <Link to="/stats/best-matches">{t('statistics.nav.bestMatches')}</Link>
        <Link to="/stats/achievements">{t('statistics.nav.achievements')}</Link>
      </div>

      <SeasonSelector
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        onSeasonChange={setSelectedSeasonId}
        compact
      />

      <WrestlerStatsContent
        wrestler={wrestler}
        overallStats={overallStats}
        matchTypeStats={matchTypeStats}
        championshipStats={championshipStats}
        achievements={achievements}
      />
    </div>
  );
}

export default EmbeddedWrestlerStats;
