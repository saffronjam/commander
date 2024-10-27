import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { PowerView } from 'src/sections/power/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Power - ${CONFIG.appName}`}</title>
      </Helmet>

      <PowerView />
    </>
  );
}
