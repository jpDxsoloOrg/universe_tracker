import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { statisticsApi } from '../../services/api';
import type { StatsWrestler } from '../../services/api';
import { useWrestlerStats } from '../../hooks/useWrestlerStats';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import WrestlerStatsContent from './WrestlerStatsContent';
import SeasonSelector from './SeasonSelector';
import './WrestlerStats.css';

function WrestlerStats() {
  const { t } = useTranslation();
  const { wrestlerId: routeWrestlerId } = useParams<{ wrestlerId: string }>();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState(routeWrestlerId || '');
  const [wrestlers, setWrestlers] = useState<StatsWrestler[]>([]);

  const {
    loading, error, seasons, selectedSeasonId, setSelectedSeasonId,
    overallStats, matchTypeStats, championshipStats, achievements,
  } = useWrestlerStats({ wrestlerId: selectedWrestlerId });

  // Load wrestler list on mount (unique to full page)
  useEffect(() => {
    const abortController = new AbortController();
    const fetchWrestlers = async () => {
      try {
        const result = await statisticsApi.getWrestlerStats(undefined, undefined, abortController.signal);
        setWrestlers(result.wrestlers);
        if (!selectedWrestlerId && result.wrestlers.length > 0 && result.wrestlers[0]) {
          setSelectedWrestlerId(result.wrestlers[0].wrestlerId);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          // Error handled by hook
        }
      }
    };
    fetchWrestlers();
    return () => abortController.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const wrestler = useMemo(
    () => wrestlers.find((p) => p.wrestlerId === selectedWrestlerId),
    [wrestlers, selectedWrestlerId]
  );

  if (loading && !overallStats) {
    return (
      <div className="wrestler-stats">
        <h2>{t('statistics.wrestlerStats.title')}</h2>
        <Skeleton variant="block" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrestler-stats">
        <h2>{t('statistics.wrestlerStats.title')}</h2>
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
      <div className="ps-header">
        <h2>{t('statistics.wrestlerStats.title')}</h2>
        <div className="ps-nav-links">
          <Link to="/stats/head-to-head">{t('statistics.nav.headToHead')}</Link>
          <Link to="/stats/leaderboards">{t('statistics.nav.leaderboards')}</Link>
          <Link to="/stats/rivalries">{t('statistics.nav.rivalries')}</Link>
          <Link to="/stats/tale-of-tape">{t('statistics.nav.taleOfTape')}</Link>
          <Link to="/stats/records">{t('statistics.nav.records')}</Link>
          <Link to="/stats/best-matches">{t('statistics.nav.bestMatches')}</Link>
          <Link to="/stats/achievements">{t('statistics.nav.achievements')}</Link>
          <Link to="/stats/match-types">{t('statistics.nav.matchTypeLeaderboards')}</Link>
        </div>
      </div>

      <div className="ps-controls">
        <div className="ps-wrestler-selector">
          <label htmlFor="wrestler-select">{t('statistics.wrestlerStats.selectWrestler')}</label>
          <select
            id="wrestler-select"
            value={selectedWrestlerId}
            onChange={(e) => setSelectedWrestlerId(e.target.value)}
          >
            {wrestlers.map((p) => (
              <option key={p.wrestlerId} value={p.wrestlerId}>
                {p.name} ({p.wrestlerName})
              </option>
            ))}
          </select>
        </div>
        <SeasonSelector
          seasons={seasons}
          selectedSeasonId={selectedSeasonId}
          onSeasonChange={setSelectedSeasonId}
        />
      </div>

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

export default WrestlerStats;
