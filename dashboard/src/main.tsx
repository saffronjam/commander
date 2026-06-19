import { StrictMode, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';

import App from './app';
import { GraphQLClientProvider } from './gql/GraphQLClientProvider';
import { AuthProvider } from './contexts/auth/AuthContext';
import { SessionAwareApiProvider } from './contexts/api/SessionAwareApiProvider';
import { DebugProvider } from './contexts/debug/DebugContext';
import { SessionProvider } from './contexts/sessions';
import { ThemeProvider } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import '@fontsource/roboto-mono';
import '@fontsource/dm-mono';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" storageKey="satisfactory-dashboard-theme">
          <TooltipProvider>
            <Suspense>
              <GraphQLClientProvider>
                <AuthProvider>
                  <DebugProvider>
                    <SessionProvider>
                      <SessionAwareApiProvider>
                        <App />
                        <Toaster />
                      </SessionAwareApiProvider>
                    </SessionProvider>
                  </DebugProvider>
                </AuthProvider>
              </GraphQLClientProvider>
            </Suspense>
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
