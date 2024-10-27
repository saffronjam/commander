import ReactDOM from 'react-dom/client';
import { Suspense, StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import App from './app';
import { ApiProvider } from './contexts/api/ApiProvider';
import '@fontsource/roboto-mono';
import '@fontsource/dm-mono';
import { NotificationsProvider } from '@toolpad/core';
import { ConnectionCheckerProvider } from './contexts/api/ConnectionChecker';

// ----------------------------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Suspense>
          <ApiProvider>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </ApiProvider>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
