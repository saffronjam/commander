import { useMemo } from 'react';
import {
  Bug,
  Factory,
  Flag,
  LayoutDashboard,
  Map,
  Network,
  Plane,
  Settings,
  TrainFront,
  Users,
  Zap,
} from 'lucide-react';
import { useUnlockables } from 'src/hooks/use-unlockables';

export type NavItem = {
  title: string;
  path?: string;
  icon: React.ReactNode;
  group: 'main' | 'sub' | 'debug';
  children?: NavItem[];
  locked?: boolean;
};

const baseNavData: NavItem[] = [
  {
    title: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard size={20} />,
    group: 'main',
  },
  {
    title: 'Map',
    path: '/map',
    icon: <Map size={20} />,
    group: 'main',
  },
  {
    title: 'Production',
    path: '/production',
    icon: <Factory size={20} />,
    group: 'main',
  },
  {
    title: 'Power',
    path: '/power',
    icon: <Zap size={20} />,
    group: 'main',
  },
  {
    title: 'Milestones',
    path: '/milestones',
    icon: <Flag size={20} />,
    group: 'main',
  },
  {
    title: 'Trains',
    path: '/trains',
    icon: <TrainFront size={20} />,
    group: 'main',
  },
  {
    title: 'Drones',
    path: '/drones',
    icon: <Plane size={20} />,
    group: 'main',
  },
  {
    title: 'Players',
    path: '/players',
    icon: <Users size={20} />,
    group: 'main',
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: <Settings size={20} />,
    group: 'main',
  },
];

const debugNavItem: NavItem = {
  title: 'Debug',
  icon: <Bug size={20} />,
  group: 'debug',
  children: [
    {
      title: 'Endpoints',
      path: '/debug',
      icon: <Network size={20} />,
      group: 'debug',
    },
  ],
};

/**
 * Returns navigation data for the dashboard sidebar based on debug mode setting.
 * Includes main navigation items and conditionally adds debug items.
 * Note: Use useNavData hook instead for lock status integration.
 */
function getNavData(isDebugMode: boolean): NavItem[] {
  if (isDebugMode) {
    return [...baseNavData, debugNavItem];
  }
  return baseNavData;
}

/**
 * Hook that returns navigation data with lock status applied based on schematics.
 * Uses useUnlockables to determine which features are locked.
 */
export function useNavData(isDebugMode: boolean): NavItem[] {
  const { isFeatureLocked } = useUnlockables();

  return useMemo(() => {
    const navData = getNavData(isDebugMode);
    return navData.map((item) => {
      if (item.path) {
        return {
          ...item,
          locked: isFeatureLocked(item.path),
        };
      }
      return item;
    });
  }, [isDebugMode, isFeatureLocked]);
}
