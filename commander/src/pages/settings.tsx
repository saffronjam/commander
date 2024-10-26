import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { SettingsView } from 'src/sections/settings/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Settings - ${CONFIG.appName}`}</title>
      </Helmet>

      <SettingsView />
    </>
  );
}
