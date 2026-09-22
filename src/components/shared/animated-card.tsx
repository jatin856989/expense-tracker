"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A thin client-only motion wrapper. Kept separate from the components that
 * use it (StatCard, etc.) so those can stay server-renderable and safely
 * accept things like Lucide icon component references as props — passing a
 * component reference as a prop into a Client Component is invalid, but
 * passing already-rendered children (this wrapper's job) is fine.
 */
export function AnimatedCard({
  children,
  index = 0,
  className,
  hover = true,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      whileHover={hover ? { y: -3 } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}
