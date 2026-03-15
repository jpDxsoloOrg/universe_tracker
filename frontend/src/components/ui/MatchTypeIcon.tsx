import './MatchTypeIcon.css';

interface MatchTypeIconProps {
  matchType: string;
  size?: number;
  className?: string;
}

function getIconType(matchType: string): string {
  const lower = matchType.toLowerCase();
  if (lower.includes('tlc')) return 'tlc';
  if (lower.includes('tag')) return 'tag-team';
  if (lower.includes('triple threat')) return 'triple-threat';
  if (lower.includes('fatal') && lower.includes('4')) return 'fatal-four-way';
  if (lower.includes('fatal') && lower.includes('four')) return 'fatal-four-way';
  if (lower.includes('hell in a cell')) return 'cage';
  if (lower.includes('cage')) return 'cage';
  if (lower.includes('ladder')) return 'ladder';
  if (lower.includes('table')) return 'table';
  if (lower.includes('royal rumble')) return 'battle-royal';
  if (lower.includes('battle royal')) return 'battle-royal';
  if (lower.includes('rumble')) return 'battle-royal';
  if (lower.includes('iron man')) return 'iron-man';
  if (lower.includes('last man standing')) return 'last-man-standing';
  if (lower.includes('singles')) return 'singles';
  return 'default';
}

function renderSvg(iconType: string, size: number) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (iconType) {
    case 'singles':
      // Single person silhouette
      return (
        <svg {...props}>
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2" />
        </svg>
      );

    case 'tag-team':
      // Two person silhouettes
      return (
        <svg {...props}>
          <circle cx="9" cy="7" r="3" />
          <circle cx="17" cy="7" r="3" />
          <path d="M3 21v-1.5a5 5 0 0 1 7.5-4.3" />
          <path d="M10.5 21v-1.5a5 5 0 0 1 10 0V21" />
        </svg>
      );

    case 'triple-threat':
      // Triangle
      return (
        <svg {...props}>
          <polygon points="12,3 22,20 2,20" fill="none" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="4" cy="19" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="20" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'fatal-four-way':
      // Diamond with four dots
      return (
        <svg {...props}>
          <polygon points="12,2 22,12 12,22 2,12" fill="none" />
          <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="20" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'cage':
      // Cage grid pattern
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <line x1="3" y1="8" x2="21" y2="8" />
          <line x1="3" y1="13" x2="21" y2="13" />
          <line x1="3" y1="18" x2="21" y2="18" />
          <line x1="8" y1="3" x2="8" y2="21" />
          <line x1="13" y1="3" x2="13" y2="21" />
          <line x1="18" y1="3" x2="18" y2="21" />
        </svg>
      );

    case 'ladder':
      // Ladder shape
      return (
        <svg {...props}>
          <line x1="8" y1="2" x2="8" y2="22" />
          <line x1="16" y1="2" x2="16" y2="22" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="11" x2="16" y2="11" />
          <line x1="8" y1="16" x2="16" y2="16" />
        </svg>
      );

    case 'table':
      // Table shape
      return (
        <svg {...props}>
          <rect x="2" y="8" width="20" height="3" rx="0.5" />
          <line x1="5" y1="11" x2="5" y2="21" />
          <line x1="19" y1="11" x2="19" y2="21" />
          <line x1="5" y1="16" x2="19" y2="16" />
        </svg>
      );

    case 'battle-royal':
      // Crown / group icon
      return (
        <svg {...props}>
          <path d="M2 18l3-10 4 5 3-8 3 8 4-5 3 10z" />
          <line x1="2" y1="18" x2="22" y2="18" />
          <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="6" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'iron-man':
      // Clock / timer
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
      );

    case 'last-man-standing':
      // Fist icon
      return (
        <svg {...props}>
          <path d="M7 20v-4a2 2 0 0 1 2-2h0" />
          <path d="M9 14V8a2 2 0 0 1 4 0v3" />
          <path d="M13 11V9a2 2 0 0 1 4 0v5" />
          <path d="M17 14v-2a2 2 0 0 1 3 1v5a6 6 0 0 1-6 6H9a6 6 0 0 1-2-1" />
          <path d="M9 14a2 2 0 0 0-2 2v0" />
        </svg>
      );

    case 'tlc':
      // Combined: ladder center, table left, chair right
      return (
        <svg {...props}>
          {/* Ladder center */}
          <line x1="10" y1="3" x2="10" y2="21" />
          <line x1="14" y1="3" x2="14" y2="21" />
          <line x1="10" y1="8" x2="14" y2="8" />
          <line x1="10" y1="14" x2="14" y2="14" />
          {/* Table left hint */}
          <line x1="1" y1="12" x2="8" y2="12" />
          <line x1="2" y1="12" x2="2" y2="17" />
          {/* Chair right hint */}
          <line x1="16" y1="12" x2="23" y2="12" />
          <line x1="22" y1="7" x2="22" y2="12" />
          <line x1="22" y1="12" x2="22" y2="17" />
        </svg>
      );

    default:
      // Wrestling ring icon
      return (
        <svg {...props}>
          <rect x="3" y="8" width="18" height="10" rx="1" />
          <line x1="3" y1="4" x2="3" y2="8" />
          <line x1="21" y1="4" x2="21" y2="8" />
          <line x1="1" y1="4" x2="23" y2="4" />
          <line x1="3" y1="13" x2="21" y2="13" />
        </svg>
      );
  }
}

export default function MatchTypeIcon({ matchType, size = 18, className = '' }: MatchTypeIconProps) {
  const iconType = getIconType(matchType);
  return (
    <span className={`match-type-icon ${className}`.trim()} aria-hidden="true">
      {renderSvg(iconType, size)}
    </span>
  );
}
