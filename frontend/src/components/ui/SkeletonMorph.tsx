import { useState, useEffect, useCallback, type ReactNode } from 'react';
import './SkeletonMorph.css';

interface SkeletonMorphProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

const TRANSITION_DURATION = 400;

export default function SkeletonMorph({ loading, skeleton, children }: SkeletonMorphProps) {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (loading) {
      // Going back to loading state
      setShowSkeleton(true);
      setTransitioning(false);
    } else if (showSkeleton) {
      // Loading just finished — start the crossfade
      setTransitioning(true);
      const timer = setTimeout(() => {
        setShowSkeleton(false);
        setTransitioning(false);
      }, TRANSITION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransitionEnd = useCallback(() => {
    if (transitioning && !loading) {
      setShowSkeleton(false);
      setTransitioning(false);
    }
  }, [transitioning, loading]);

  // Still loading, no transition yet
  if (loading && !transitioning) {
    return (
      <div className="skeleton-morph">
        <div className="skeleton-morph-layer skeleton-morph-skeleton">
          {skeleton}
        </div>
      </div>
    );
  }

  return (
    <div className="skeleton-morph">
      {showSkeleton && (
        <div
          className={`skeleton-morph-layer skeleton-morph-skeleton${transitioning ? ' skeleton-morph-exit' : ''}`}
          onTransitionEnd={handleTransitionEnd}
        >
          {skeleton}
        </div>
      )}
      <div
        className={`skeleton-morph-layer skeleton-morph-content${!loading ? ' skeleton-morph-enter' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
