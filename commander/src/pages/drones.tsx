import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { DronesView } from 'src/sections/drones/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Drones - ${CONFIG.appName}`}</title>
      </Helmet>

      <DronesView />
    </>
  );
}
