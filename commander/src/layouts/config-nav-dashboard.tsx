import path from 'path';
import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor width="100%" height="100%" src={`/assets/icons/navbar/${name}.svg`} />
);

export const navData = [
  {
    title: 'Dashboard',
    path: '/',
    icon: <Iconify icon="uim:graph-bar" width={24} height={24} />,
  },
  {
    title: 'Production',
    path: '/production',
    icon: <Iconify icon="mdi:factory" width={24} height={24} />,
  },
  {
    title: 'Inventory',
    path: '/inventory',
    icon: <Iconify icon="mdi:package-variant" width={24} height={24} />,
  },
  {
    title: 'Players',
    path: '/players',
    icon: <Iconify icon="mdi:account-group" width={24} height={24} />,
  },
];
