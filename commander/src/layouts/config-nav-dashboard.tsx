import { ReactNode } from 'react';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const navData = [
  {
    title: 'Dashboard',
    path: '/',
    icon: <Iconify icon="mage:dashboard-fill" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Map',
    path: '/map',
    icon: <Iconify icon="mdi:map" width={24} height={24} />,
    group: 'main',
  },
  {
    title: 'Production',
    path: '/production',
    icon: <Iconify icon="material-symbols:factory" width={24} height={24} />,
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
    title: 'Drones',
    path: '/drones',
    icon: <Iconify icon="mdi:drone" width={24} height={24} />,
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
