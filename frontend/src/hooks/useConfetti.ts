import { useState, useCallback } from 'react';

export function useConfetti() {
  const [isExploding, setIsExploding] = useState(false);

  const triggerConfetti = useCallback(() => {
    setIsExploding(true);
    // Auto-reset after animation
    setTimeout(() => setIsExploding(false), 3000);
  }, []);

  return { isExploding, triggerConfetti };
}
