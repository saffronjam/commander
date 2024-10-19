import type { Theme, SxProps, Breakpoint } from '@mui/material/styles';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';

import { _langs, _notifications } from 'src/_mock';

import { Main } from './main';
import { layoutClasses } from '../classes';
import { NavMobile, NavDesktop } from './nav';
import { navData } from '../config-nav-dashboard';
import { MenuButton } from '../components/menu-button';
import { LayoutSection } from '../core/layout-section';
import { HeaderSection } from '../core/header-section';

// ----------------------------------------------------------------------

export type DashboardLayoutProps = {
  sx?: SxProps<Theme>;
  children: React.ReactNode;
  header?: {
    sx?: SxProps<Theme>;
  };
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  type: string;
  postedAt: string;
  isUnRead: boolean;
};

export function DashboardLayout({ sx, children, header }: DashboardLayoutProps) {
  const theme = useTheme();

  const [navOpen, setNavOpen] = useState(false);
  const [notifications, setNotifications] = useState([] as Notification[]);

  const layoutQuery: Breakpoint = 'lg';

  useEffect(() => {
    setNotifications([
      {
        id: '1',
        title: 'You have a new message',
        description: 'Hello, can you help me with this?',
        type: 'message',
        postedAt: '2022-01-01T00:00:00.000Z',
        isUnRead: true,
      },
      {
        id: '2',
        title: 'New user registered',
        description: 'Just now',
        type: 'user',
        postedAt: '2022-01-01T00:00:00.000Z',
        isUnRead: true,
      },
    ]);
  }, []);

  return (
    <LayoutSection
      /** **************************************
       * Header
       *************************************** */
      headerSection={
        <HeaderSection
          layoutQuery={layoutQuery}
          slotProps={{
            container: {
              maxWidth: false,
              sx: { px: { [layoutQuery]: 5 } },
            },
          }}
          sx={header?.sx}
          slots={{
            topArea: (
              <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
                This is an info Alert.
              </Alert>
            ),
            leftArea: (
              <>
                <MenuButton
                  onClick={() => setNavOpen(true)}
                  sx={{
                    ml: -1,
                    [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
                  }}
                />
                <NavMobile data={navData} open={navOpen} onClose={() => setNavOpen(false)} />
              </>
            ),
          }}
        />
      }
      /** **************************************
       * Sidebar
       *************************************** */
      sidebarSection={<NavDesktop data={navData} layoutQuery={layoutQuery} />}
      /** **************************************
       * Footer
       *************************************** */
      footerSection={null}
      /** **************************************
       * Style
       *************************************** */
      cssVars={{
        '--layout-nav-vertical-width': '300px',
        '--layout-dashboard-content-pt': theme.spacing(1),
        '--layout-dashboard-content-pb': theme.spacing(8),
        '--layout-dashboard-content-px': theme.spacing(5),
      }}
      sx={{
        [`& .${layoutClasses.hasSidebar}`]: {
          [theme.breakpoints.up(layoutQuery)]: {
            pl: 'var(--layout-nav-vertical-width)',
          },
        },
        ...sx,
      }}
    >
      <Main>{children}</Main>
    </LayoutSection>
  );
}
