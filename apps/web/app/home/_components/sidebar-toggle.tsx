'use client';

import { ChevronsLeft, ChevronsRight, PanelLeft } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { useSidebar } from '@kit/ui/sidebar';
import { cn } from '@kit/ui/utils';

/**
 * Desktop/sidebar toggle with RTL-aware chevrons.
 * Sidebar is on the right in Bayya3een admin.
 */
export function SidebarToggle({
  className,
  variant = 'sidebar',
}: {
  className?: string;
  variant?: 'sidebar' | 'hero';
}) {
  const { toggleSidebar, state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';

  if (isMobile && variant === 'sidebar') {
    return null;
  }

  const Icon =
    variant === 'hero'
      ? PanelLeft
      : collapsed
        ? ChevronsLeft
        : ChevronsRight;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={collapsed ? 'فتح القائمة' : 'طي القائمة'}
      title={collapsed ? 'فتح القائمة' : 'طي القائمة'}
      className={cn(
        variant === 'sidebar'
          ? 'size-8 rounded-lg text-[#C9CBE3] hover:bg-white/10 hover:text-white'
          : 'size-8 rounded-lg text-white/80 hover:bg-white/10 hover:text-white',
        className,
      )}
      onClick={toggleSidebar}
    >
      <Icon className="size-4" />
    </Button>
  );
}
