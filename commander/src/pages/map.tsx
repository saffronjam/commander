import { Helmet } from 'react-helmet-async';
import { LeafletContext } from '@react-leaflet/core';

import { CONFIG } from 'src/config-global';

import { MapView } from 'src/sections/map/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Power - ${CONFIG.appName}`}</title>
      </Helmet>

      <MapView />
    </>
  );
}
