import {
  BadgePercent,
  Boxes,
  Crown,
  Home,
  ImageIcon,
  KeyRound,
  LineChart,
  Link2,
  Package,
  Store,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

const routes = [
  {
    label: 'common.routes.main',
    children: [
      {
        label: 'common.routes.home',
        path: pathsConfig.app.home,
        Icon: <Home className={iconClasses} />,
        highlightMatch: `^${pathsConfig.app.home}$`,
      },
      {
        label: 'common.routes.performance',
        path: pathsConfig.app.performance,
        Icon: <LineChart className={iconClasses} />,
      },
    ],
  },
  {
    label: 'common.routes.operations',
    children: [
      {
        label: 'common.routes.products',
        path: pathsConfig.app.products,
        Icon: <Package className={iconClasses} />,
      },
      {
        label: 'common.routes.banners',
        path: pathsConfig.app.banners,
        Icon: <ImageIcon className={iconClasses} />,
      },
      {
        label: 'common.routes.orders',
        path: pathsConfig.app.orders,
        Icon: <Boxes className={iconClasses} />,
      },
      {
        label: 'common.routes.customers',
        path: pathsConfig.app.customers,
        Icon: <Users className={iconClasses} />,
      },
    ],
  },
  {
    label: 'common.routes.partners',
    children: [
      {
        label: 'common.routes.merchants',
        path: pathsConfig.app.merchants,
        Icon: <Store className={iconClasses} />,
      },
      {
        label: 'common.routes.affiliates',
        path: pathsConfig.app.affiliates,
        Icon: <Link2 className={iconClasses} />,
      },
    ],
  },
  {
    label: 'common.routes.money',
    children: [
      {
        label: 'common.routes.commissions',
        path: pathsConfig.app.commissions,
        Icon: <BadgePercent className={iconClasses} />,
      },
      {
        label: 'common.routes.subscriptions',
        path: pathsConfig.app.subscriptions,
        Icon: <Crown className={iconClasses} />,
      },
      {
        label: 'common.routes.finance',
        path: pathsConfig.app.finance,
        Icon: <Wallet className={iconClasses} />,
      },
    ],
  },
  {
    label: 'common.routes.system',
    children: [
      {
        label: 'common.routes.roles',
        path: pathsConfig.app.roles,
        Icon: <KeyRound className={iconClasses} />,
      },
      {
        label: 'common.routes.profile',
        path: pathsConfig.app.profileSettings,
        Icon: <User className={iconClasses} />,
      },
    ],
  },
] satisfies z.infer<typeof NavigationConfigSchema>['routes'];

export const navigationConfig = NavigationConfigSchema.parse({
  routes,
  style: process.env.NEXT_PUBLIC_NAVIGATION_STYLE,
  sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
});
