import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface AnimatedListItemProps {
  children: ReactNode;
  index?: number;
}

export function AnimatedListItem({ children, index = 0 }: AnimatedListItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      {children}
    </motion.div>
  );
}
