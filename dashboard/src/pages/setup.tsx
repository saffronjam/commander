import { Helmet } from 'react-helmet-async';
import { CONFIG } from 'src/config-global';
import { SetupView } from 'src/sections/setup';

/**
 * First-run setup page. Claims the instance and optionally sets an access key.
 */
export default function SetupPage() {
  return (
    <>
      <Helmet>
        <title>{`Setup - ${CONFIG.appName}`}</title>
      </Helmet>

      <SetupView />
    </>
  );
}
