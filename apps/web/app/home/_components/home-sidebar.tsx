import { Suspense } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@kit/ui/sidebar';
import { SidebarNavigation } from '@kit/ui/sidebar-navigation';
import { Skeleton } from '@kit/ui/skeleton';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { navigationConfig } from '~/config/navigation.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { SidebarToggle } from './sidebar-toggle';

export function HomeSidebar() {
  return (
    <Sidebar side="right" collapsible={'icon'} className="by-admin-sidebar">
      <SidebarHeader className="by-sidebar-header gap-2 border-b border-[#1F2557] p-2">
        <div className="by-sidebar-brand flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <AppLogo
            href="/home"
            variant="dark"
            className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none"
          />
          <SidebarToggle className="shrink-0 group-data-[collapsible=icon]:mx-auto" />
        </div>
        <div className="rounded-xl bg-[rgba(255,255,255,0.06)] px-3 py-2.5 text-[12px] font-semibold text-[#E4E3F5] group-data-[collapsible=icon]:hidden">
          <div>لوحة إدارة بياعين</div>
          <small className="mt-0.5 block font-medium text-[#A7AACB]">
            Admin · Neon Souq
          </small>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* usePathname() inside SidebarNavigation must stream after prerender on dynamic routes */}
        <Suspense fallback={<NavigationFallback />}>
          <SidebarNavigation config={navigationConfig} />
        </Suspense>
      </SidebarContent>

      <SidebarFooter className="border-t border-[#1F2557]">
        <Suspense fallback={<AccountDropdownFallback />}>
          <AccountDropdown />
        </Suspense>
        <p className="px-2 pb-2 text-[10.5px] leading-4 font-medium text-[#6E72A0] group-data-[collapsible=icon]:hidden">
          بياعين · بيانات تجريبية محلية
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

async function AccountDropdown() {
  const user = await requireUserInServerComponent();

  return <ProfileAccountDropdownContainer user={user} />;
}

function AccountDropdownFallback() {
  return (
    <div className={'flex items-center gap-x-2 p-2'}>
      <Skeleton className={'size-8 shrink-0 rounded-full'} />
      <Skeleton className={'h-4 w-full'} />
    </div>
  );
}

function NavigationFallback() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}
