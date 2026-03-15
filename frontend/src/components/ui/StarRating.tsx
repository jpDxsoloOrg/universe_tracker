import './StarRating.css';

interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  animated?: boolean;
}

const STAR_COLOR_FILLED = '#fbbf24';
const STAR_COLOR_EMPTY = 'var(--color-border, #4b5563)';

function StarIcon({ fill }: { fill: 'full' | 'half' | 'empty' }) {
  if (fill === 'full') {
    return (
      <svg viewBox="0 0 24 24" fill={STAR_COLOR_FILLED} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }

  if (fill === 'half') {
    return (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="star-left-half">
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
          <clipPath id="star-right-half">
            <rect x="12" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={STAR_COLOR_FILLED}
          clipPath="url(#star-left-half)"
        />
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="none"
          stroke={STAR_COLOR_EMPTY}
          strokeWidth="1.5"
          clipPath="url(#star-right-half)"
        />
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={STAR_COLOR_FILLED}
          clipPath="url(#star-left-half)"
        />
      </svg>
    );
  }

  // empty
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={STAR_COLOR_EMPTY}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

export default function StarRating({
  rating,
  size = 'md',
  showValue = true,
  animated = true,
}: StarRatingProps) {
  const stars: Array<'full' | 'half' | 'empty'> = [];
  const clamped = Math.max(0, Math.min(5, rating));

  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(clamped)) {
      stars.push('full');
    } else if (i === Math.ceil(clamped) && clamped % 1 >= 0.25) {
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }

  const sizeClass = `star-rating--${size}`;
  const animateClass = animated ? '' : 'star-rating--no-animate';

  return (
    <span className={`star-rating ${sizeClass} ${animateClass}`}>
      {stars.map((fill, index) => (
        <span
          key={index}
          className="star-rating-star"
          style={{ '--star-index': index } as React.CSSProperties}
        >
          <StarIcon fill={fill} />
        </span>
      ))}
      {showValue && (
        <span className="star-rating-value">{clamped % 1 === 0 ? clamped : clamped.toFixed(1)}</span>
      )}
    </span>
  );
}
