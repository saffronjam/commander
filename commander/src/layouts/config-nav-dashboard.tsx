import { ReactNode } from 'react';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const navData = [
  {
    title: 'Dashboard',
    path: '/',
    icon: <Iconify icon="uim:graph-bar" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Production',
    path: '/production',
    icon: <Iconify icon="mdi:factory" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Inventory',
    path: '/inventory',
    icon: <Iconify icon="mdi:package-variant" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Power',
    path: '/power',
    icon: <Iconify icon="mdi:flash" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Trains',
    path: '/trains',
    icon: <Iconify icon="mdi:train" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Players',
    path: '/players',
    icon: <Iconify icon="mdi:account-group" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: <Iconify icon="mdi:cog" width={24} height={24} />,
    group: 'sub',
  },
] as any;
