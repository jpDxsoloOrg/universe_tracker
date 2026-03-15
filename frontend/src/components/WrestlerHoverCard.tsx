import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Wrestler } from '../types';
import type { Division } from '../types';
import './WrestlerHoverCard.css';

interface WrestlerHoverCardProps {
  wrestler: Wrestler;
  divisions: Division[];
  children: React.ReactNode;
}

export default function WrestlerHoverCard({ wrestler, divisions, children }: WrestlerHoverCardProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const divisionName = divisions.find((d) => d.divisionId === wrestler.divisionId)?.name ?? null;
  const lastResult = wrestler.recentForm?.[0];

  const handleMouseEnter = useCallback(() => setVisible(true), []);
  const handleMouseLeave = useCallback(() => setVisible(false), []);

  return (
    <span
      className="wrestler-hover-card-trigger"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div className="wrestler-hover-card" role="tooltip">
          {divisionName !== null && (
            <div className="wrestler-hover-card-row">
              <span className="wrestler-hover-card-label">{t('standings.table.division')}:</span>
              <span>{divisionName}</span>
            </div>
          )}
          {lastResult !== undefined && (
            <div className="wrestler-hover-card-row">
              <span className="wrestler-hover-card-label">{t('standings.lastResult')}:</span>
              <span>{lastResult === 'W' ? 'W' : lastResult === 'L' ? 'L' : 'D'}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
