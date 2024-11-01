import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { TrainsView } from 'src/sections/trains/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Trains - ${CONFIG.appName}`}</title>
      </Helmet>

      <TrainsView />
    </>
  );
}
