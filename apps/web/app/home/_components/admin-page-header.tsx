'use client';

import type { ReactNode } from 'react';

import {
  ModuleHeroHeader,
  type ModuleStat,
} from './module-hero-header';

/**
 * Shared module header for all main admin screens.
 * Visual language mirrors Tajeer Plus, colors are Neon Souq.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  stats,
  searchPlaceholder,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  stats?: ModuleStat[];
  searchPlaceholder?: string;
  /** @deprecated kept for call-site compatibility */
  breadcrumbValues?: Record<string, string>;
  className?: string;
}) {
  return (
    <ModuleHeroHeader
      title={title}
      description={description}
      actions={actions}
      stats={stats}
      searchPlaceholder={searchPlaceholder}
      className={className}
    />
  );
}

export type { ModuleStat };
