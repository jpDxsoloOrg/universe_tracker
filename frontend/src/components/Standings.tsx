import { useEffect, useState, useCallback, useMemo, useTransition, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { standingsApi, seasonsApi, divisionsApi, companiesApi } from '../services/api';
import { logger } from '../utils/logger';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { Standings as StandingsType, Season, Division, Company, Wrestler } from '../types';
import WrestlerHoverCard from './WrestlerHoverCard';
import DivisionFilter from './DivisionFilter';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import {
  DEFAULT_WRESTLER_IMAGE,
  applyImageFallback,
  resolveImageSrc,
} from '../constants/imageFallbacks';
import './Standings.css';

const PAGE_SIZE = 50;

interface StandingsRowProps {
  wrestler: Wrestler & { winPercentage: string };
  index: number;
  divisions: Division[];
  showDivision: boolean;
  getDivisionName: (id?: string) => string | null;
  onNavigate: (id: string) => void;
}

const StandingsRow = memo(function StandingsRow({
  wrestler,
  index,
  divisions,
  showDivision,
  getDivisionName,
  onNavigate,
}: StandingsRowProps) {
  return (
    <tr
      className="standings-row-clickable"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(wrestler.wrestlerId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNavigate(wrestler.wrestlerId);
        }
      }}
    >
      <td className="rank">{index + 1}</td>
      <td className="wrestler-image-cell">
        <img
          src={resolveImageSrc(wrestler.imageUrl, DEFAULT_WRESTLER_IMAGE)}
          onError={(event) => applyImageFallback(event, DEFAULT_WRESTLER_IMAGE)}
          alt={wrestler.name}
          className="wrestler-thumbnail"
          loading="lazy"
        />
      </td>
      <td className="wrestler-name">
        <WrestlerHoverCard wrestler={wrestler} divisions={divisions}>
          <Link
            to={`/stats/wrestler/${wrestler.wrestlerId}`}
            className="wrestler-name-link"
            onClick={(e) => e.stopPropagation()}
          >
            {wrestler.name}
          </Link>
        </WrestlerHoverCard>
      </td>
      {showDivision && (
        <td className="division-name">
          {getDivisionName(wrestler.divisionId) || <span className="no-division">-</span>}
        </td>
      )}
      <td className="wins">{wrestler.wins}</td>
      <td className="losses">{wrestler.losses}</td>
      <td className="draws">{wrestler.draws}</td>
      <td className="win-percentage">{wrestler.winPercentage}%</td>
      <td className="form-cell">
        {wrestler.recentForm && wrestler.recentForm.length > 0 ? (
          <span className="form-dots" aria-label={wrestler.recentForm.join(', ')}>
            {wrestler.recentForm.map((r, i) => (
              <span
                key={i}
                className={`form-dot ${r === 'W' ? 'win' : r === 'L' ? 'loss' : 'draw'}`}
                title={r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'}
              />
            ))}
          </span>
        ) : (
          <span className="form-empty">-</span>
        )}
      </td>
      <td className="streak-cell">
        {wrestler.currentStreak && wrestler.currentStreak.count >= 3 ? (
          <span
            className={`streak-badge ${wrestler.currentStreak.type === 'W' ? 'hot' : wrestler.currentStreak.type === 'L' ? 'cold' : 'neutral'}`}
          >
            {wrestler.currentStreak.type === 'W' && '\u{1f525} '}
            {wrestler.currentStreak.type === 'L' && '\u{2744}\u{fe0f} '}
            {wrestler.currentStreak.type === 'D' && '\u{2796} '}
            {wrestler.currentStreak.count}
            {wrestler.currentStreak.type === 'W' ? 'W' : wrestler.currentStreak.type === 'L' ? 'L' : 'D'}
          </span>
        ) : (
          <span className="streak-empty">-</span>
        )}
      </td>
    </tr>
  );
});

export default function Standings() {
  const { t } = useTranslation();
  useDocumentTitle(t('standings.title'));
  const navigate = useNavigate();
  const [standings, setStandings] = useState<StandingsType | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  // Reload standings when retry button is clicked
  const loadStandings = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError(null);
      const data = await standingsApi.get(selectedSeasonId || undefined);
      setStandings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load standings');
    } finally {
      setInitialLoading(false);
    }
  }, [selectedSeasonId]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchInitialData = async () => {
      try {
        const [seasonsData, divisionsData, companiesData] = await Promise.all([
          seasonsApi.getAll(abortController.signal),
          divisionsApi.getAll(abortController.signal),
          companiesApi.getAll(abortController.signal),
        ]);
        if (!abortController.signal.aborted) {
          setSeasons(seasonsData);
          setDivisions(divisionsData);
          setCompanies(companiesData);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          logger.error('Failed to load initial standings data');
        }
      }
    };

    fetchInitialData();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchStandings = async () => {
      // Use refreshing (not initialLoading) for season switches after first load
      if (standings) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }
      setError(null);

      try {
        const data = await standingsApi.get(selectedSeasonId || undefined, abortController.signal);
        if (!abortController.signal.aborted) {
          setStandings(data);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load standings');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    };

    fetchStandings();
    return () => abortController.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeasonId]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCompany, selectedDivision, selectedSeasonId]);

  // Divisions filtered to selected company
  const visibleDivisions = useMemo(() => {
    if (selectedCompany === 'all') return divisions;
    if (selectedCompany === 'none') return [];
    return divisions.filter((d) => d.companyId === selectedCompany || !d.companyId);
  }, [divisions, selectedCompany]);

  // Memoize filtered wrestlers to avoid recalculation on every render
  const filteredWrestlers = useMemo((): Wrestler[] => {
    if (!standings) return [];

    let result = standings.wrestlers;

    // Company filter
    if (selectedCompany === 'none') {
      result = result.filter((w) => !w.companyId);
    } else if (selectedCompany !== 'all') {
      result = result.filter((w) => w.companyId === selectedCompany);
    }

    // Division filter
    if (selectedDivision === 'none') {
      result = result.filter((w) => !w.divisionId);
    } else if (selectedDivision !== 'all') {
      result = result.filter((w) => w.divisionId === selectedDivision);
    }

    return result;
  }, [standings, selectedCompany, selectedDivision]);

  // Memoize wrestler data with calculated win percentages
  const wrestlersWithStats = useMemo(() => {
    return filteredWrestlers.map(wrestler => {
      const totalMatches = wrestler.wins + wrestler.losses + wrestler.draws;
      const winPercentage = totalMatches > 0
        ? ((wrestler.wins / totalMatches) * 100).toFixed(1)
        : '0.0';
      return { ...wrestler, winPercentage };
    });
  }, [filteredWrestlers]);

  // Paginated slice
  const visibleWrestlers = useMemo(
    () => wrestlersWithStats.slice(0, visibleCount),
    [wrestlersWithStats, visibleCount]
  );

  const hasMore = visibleCount < wrestlersWithStats.length;

  const handleShowMore = () => {
    startTransition(() => {
      setVisibleCount((c) => c + PAGE_SIZE);
    });
  };

  const getDivisionName = useCallback((divisionId?: string) => {
    if (!divisionId) return null;
    const division = divisions.find(d => d.divisionId === divisionId);
    return division?.name || null;
  }, [divisions]);

  const getSeasonName = useCallback(() => {
    if (!selectedSeasonId) return t('standings.allTime');
    const season = seasons.find(s => s.seasonId === selectedSeasonId);
    return season ? season.name : t('standings.allTime');
  }, [selectedSeasonId, seasons, t]);

  const handleNavigate = useCallback((wrestlerId: string) => {
    navigate(`/stats/wrestler/${wrestlerId}`);
  }, [navigate]);

  const handleCompanyChange = useCallback((value: string) => {
    startTransition(() => {
      setSelectedCompany(value);
      setSelectedDivision('all');
    });
  }, []);

  const handleDivisionChange = useCallback((value: string) => {
    startTransition(() => {
      setSelectedDivision(value);
    });
  }, []);

  if (initialLoading) {
    return <Skeleton variant="table" className="standings-skeleton" />;
  }

  if (error) {
    return (
      <div className="error">
        <p>{t('common.error')}: {error}</p>
        <button onClick={loadStandings}>{t('common.retry')}</button>
      </div>
    );
  }

  if (!standings || standings.wrestlers.length === 0) {
    return (
      <EmptyState
        title={t('standings.pageTitle')}
        description={t('standings.noWrestlers')}
      />
    );
  }

  const showDivision = selectedDivision === 'all';

  return (
    <div className={`standings-container ${refreshing || isPending ? 'standings-refreshing' : ''}`}>
      <div className="standings-header">
        <h2>{t('standings.title')}</h2>
        {seasons.length > 0 && (
          <div className="season-selector">
            <label htmlFor="season-select">{t('standings.season')}:</label>
            <select
              id="season-select"
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
            >
              <option value="">{t('standings.allTime')}</option>
              {seasons.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.name} {season.status === 'active' ? `(${t('common.active')})` : ''}
                </option>
              ))}
            </select>
            <span className="season-selector-help">
              {t(
                'standings.seasonHelp',
                'Choose a season for season-only standings, or All-Time for overall records.'
              )}
            </span>
          </div>
        )}
      </div>

      {selectedSeasonId && (
        <div className="season-badge">
          {t('standings.showingFor')}: <strong>{getSeasonName()}</strong>
        </div>
      )}

      {companies.length > 0 && (
        <div className="standings-company-filter">
          <label htmlFor="company-filter">{t('standings.filterByCompany', 'Company')}:</label>
          <select
            id="company-filter"
            value={selectedCompany}
            onChange={(e) => handleCompanyChange(e.target.value)}
          >
            <option value="all">{t('common.all')}</option>
            <option value="none">{t('standings.noCompany', 'No Company')}</option>
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {(visibleDivisions.length > 0 || selectedCompany !== 'all') && selectedCompany !== 'none' && (
        <DivisionFilter
          divisions={visibleDivisions}
          selectedDivision={selectedDivision}
          onSelect={handleDivisionChange}
          labelKey="standings.filterByDivision"
          showNoDivision
        />
      )}

      {refreshing && (
        <div className="standings-loading-bar" />
      )}

      <div className="standings-table-wrapper">
        <table className="standings-table">
          <thead>
            <tr>
              <th>{t('standings.table.rank')}</th>
              <th className="image-header">{t('standings.table.image')}</th>
              <th>{t('standings.table.wrestler')}</th>
              {showDivision && <th>{t('standings.table.division')}</th>}
              <th>{t('standings.table.wins')}</th>
              <th>{t('standings.table.losses')}</th>
              <th>{t('standings.table.draws')}</th>
              <th>{t('standings.table.winPercent')}</th>
              <th>{t('standings.table.form')}</th>
              <th>{t('standings.table.streak')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleWrestlers.map((wrestler, index) => (
              <StandingsRow
                key={wrestler.wrestlerId}
                wrestler={wrestler}
                index={index}
                divisions={divisions}
                showDivision={showDivision}
                getDivisionName={getDivisionName}
                onNavigate={handleNavigate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="standings-show-more">
          <button onClick={handleShowMore} disabled={isPending}>
            {isPending ? t('common.loading') : t('standings.showMore', `Show More (${wrestlersWithStats.length - visibleCount} remaining)`)}
          </button>
          <span className="standings-count">
            {visibleCount} of {wrestlersWithStats.length}
          </span>
        </div>
      )}
    </div>
  );
}
