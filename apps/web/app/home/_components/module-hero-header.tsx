'use client';

import type { ReactNode } from 'react';

import { Bell, Globe, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { SidebarToggle } from './sidebar-toggle';

export type ModuleStat = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
};

/**
 * Tajeer Plus–style module hero header, recolored for Neon Souq.
 */
export function ModuleHeroHeader({
  title,
  description,
  actions,
  stats,
  searchPlaceholder = 'دور على طلب، منتج، تاجر، بيّاع...',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  stats?: ModuleStat[];
  searchPlaceholder?: string;
  className?: string;
}) {
  return (
    <section className={cn('by-module-hero', className)}>
      <div className="by-module-hero__bg" aria-hidden />

      <div className="by-module-hero__inner">
        <div className="by-module-hero__toolbar">
          <div className="by-module-hero__search-wrap">
            <SidebarToggle variant="hero" />
            <label className="by-module-hero__search">
              <Search className="size-4 shrink-0 text-[#7A00FF]" />
              <Input
                className="h-auto border-0 bg-transparent p-0 text-[13px] text-[#0B0F2E] shadow-none placeholder:text-[#8B90B0] focus-visible:ring-0"
                placeholder={searchPlaceholder}
              />
            </label>
          </div>

          <div className="by-module-hero__utils">
            <span className="by-module-hero__status">
              <span className="by-module-hero__status-dot" />
              بياعين متصل
            </span>

            <button
              type="button"
              className="by-module-hero__lang"
              aria-label="اللغة"
            >
              <Globe className="size-3.5" />
              EN
            </button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-9 rounded-full text-white hover:bg-white/10 hover:text-white"
              aria-label="الإشعارات"
            >
              <Bell className="size-4" />
              <span className="by-module-hero__bell-badge">3</span>
            </Button>
          </div>
        </div>

        <div className="by-module-hero__title-row">
          <div className="min-w-0">
            <h1 className="by-module-hero__title">{title}</h1>
            {description ? (
              <p className="by-module-hero__desc">{description}</p>
            ) : null}
          </div>

          {actions ? (
            <div className="by-module-hero__actions">{actions}</div>
          ) : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="by-module-hero__stats">
            {stats.map((stat) => (
              <div key={stat.label} className="by-module-hero__stat">
                <div className="by-module-hero__stat-top">
                  <span className="by-module-hero__stat-label">
                    {stat.label}
                  </span>
                  {stat.icon ? (
                    <span className="by-module-hero__stat-icon">
                      {stat.icon}
                    </span>
                  ) : null}
                </div>
                <div className="by-module-hero__stat-value" data-numeric>
                  {stat.value}
                </div>
                {stat.hint ? (
                  <div className="by-module-hero__stat-hint">{stat.hint}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
