import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rivalriesApi, seasonsApi } from '../../services/api';
import type { Rivalry } from '../../services/api/rivalries.api';
import type { Season } from '../../types';
import {
  DEFAULT_WRESTLER_IMAGE,
  applyImageFallback,
  resolveImageSrc,
} from '../../constants/imageFallbacks';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import SeasonSelector from './SeasonSelector';
import './Rivalries.css';

function Rivalries() {
  const { t } = useTranslation();
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  useEffect(() => {
    const abortController = new AbortController();
    seasonsApi.getAll(abortController.signal)
      .then(setSeasons)
      .catch(() => {});
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const fetchRivalries = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await rivalriesApi.getRivalries(
          selectedSeasonId || undefined,
          abortController.signal
        );
        setRivalries(result.rivalries);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRivalries();
    return () => abortController.abort();
  }, [selectedSeasonId]);

  function seriesRecordText(r: Rivalry): string {
    const p1W = r.wrestler1Wins;
    const p2W = r.wrestler2Wins;
    const p1 = r.wrestler1?.wrestlerName ?? r.wrestler1Id;
    const p2 = r.wrestler2?.wrestlerName ?? r.wrestler2Id;
    if (p1W > p2W) return t('rivalries.leads', { name: p1, wins: p1W, losses: p2W });
    if (p2W > p1W) return t('rivalries.leads', { name: p2, wins: p2W, losses: p1W });
    return t('rivalries.tied', { count: p1W });
  }

  function intensityLabel(badge: 'heatingUp' | 'intense' | 'historic'): string {
    switch (badge) {
      case 'heatingUp': return t('rivalries.intensity.heatingUp');
      case 'intense': return t('rivalries.intensity.intense');
      case 'historic': return t('rivalries.intensity.historic');
      default: return '';
    }
  }

  if (loading) {
    return (
      <div className="rivalries">
        <h2>{t('rivalries.title')}</h2>
        <Skeleton variant="block" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rivalries">
        <h2>{t('rivalries.title')}</h2>
        <p className="rivalries-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="rivalries">
      <div className="rivalries-header">
        <h2>{t('rivalries.title')}</h2>
        <div className="rivalries-nav-links">
          <Link to="/stats">{t('statistics.nav.wrestlerStats')}</Link>
          <Link to="/stats/head-to-head">{t('statistics.nav.headToHead')}</Link>
          <Link to="/stats/leaderboards">{t('statistics.nav.leaderboards')}</Link>
          <Link to="/stats/tale-of-tape">{t('statistics.nav.taleOfTape')}</Link>
          <Link to="/stats/records">{t('statistics.nav.records')}</Link>
          <Link to="/stats/achievements">{t('statistics.nav.achievements')}</Link>
        </div>
      </div>

      <SeasonSelector
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        onSeasonChange={setSelectedSeasonId}
      />

      {rivalries.length === 0 ? (
        <EmptyState
          title={t('rivalries.title')}
          description={t('rivalries.noRivalries')}
        />
      ) : (
        <div className="rivalries-grid">
          {rivalries.map((r) => (
            <div key={`${r.wrestler1Id}-${r.wrestler2Id}`} className="rivalry-card">
              <div className="rivalry-card-wrestlers">
                <div className="rivalry-wrestler">
                  <img
                    src={resolveImageSrc(r.wrestler1?.imageUrl, DEFAULT_WRESTLER_IMAGE)}
                    onError={(event) => applyImageFallback(event, DEFAULT_WRESTLER_IMAGE)}
                    alt={r.wrestler1?.wrestlerName ?? r.wrestler1Id}
                    className="rivalry-wrestler-img"
                  />
                  <span className="rivalry-wrestler-name">{r.wrestler1?.wrestlerName ?? r.wrestler1Id}</span>
                </div>
                <span className="rivalry-vs">vs</span>
                <div className="rivalry-wrestler">
                  <img
                    src={resolveImageSrc(r.wrestler2?.imageUrl, DEFAULT_WRESTLER_IMAGE)}
                    onError={(event) => applyImageFallback(event, DEFAULT_WRESTLER_IMAGE)}
                    alt={r.wrestler2?.wrestlerName ?? r.wrestler2Id}
                    className="rivalry-wrestler-img"
                  />
                  <span className="rivalry-wrestler-name">{r.wrestler2?.wrestlerName ?? r.wrestler2Id}</span>
                </div>
              </div>
              <p className="rivalry-series">{seriesRecordText(r)}</p>
              <p className="rivalry-meta">
                {t('rivalries.recentMatches')}: {r.matchCount}
                {r.championshipMatches > 0 && ` · ${t('rivalries.championshipAtStake')}`}
              </p>
              <span className={`rivalry-badge rivalry-badge-${r.intensityBadge}`}>
                {intensityLabel(r.intensityBadge)}
              </span>
              <Link
                to={`/stats/head-to-head?wrestler1Id=${r.wrestler1Id}&wrestler2Id=${r.wrestler2Id}`}
                className="rivalry-link"
              >
                {t('rivalries.viewHeadToHead')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Rivalries;
