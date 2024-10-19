import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { PlayersView } from 'src/sections/players/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Players - ${CONFIG.appName}`}</title>
      </Helmet>

      <PlayersView />
    </>
  );
}
