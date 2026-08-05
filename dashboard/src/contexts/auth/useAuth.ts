import { useContextSelector } from 'use-context-selector';
import { AuthContext, AuthContextType } from './AuthContext';

/**
 * Hook for accessing authentication state and actions.
 * Uses context selectors for optimized re-renders.
 */
export function useAuth(): AuthContextType {
  const initialized = useContextSelector(AuthContext, (ctx) => ctx.initialized);
  const authRequired = useContextSelector(AuthContext, (ctx) => ctx.authRequired);
  const authenticated = useContextSelector(AuthContext, (ctx) => ctx.authenticated);
  const isLoading = useContextSelector(AuthContext, (ctx) => ctx.isLoading);
  const error = useContextSelector(AuthContext, (ctx) => ctx.error);
  const sessionExpired = useContextSelector(AuthContext, (ctx) => ctx.sessionExpired);
  const login = useContextSelector(AuthContext, (ctx) => ctx.login);
  const logout = useContextSelector(AuthContext, (ctx) => ctx.logout);
  const checkAuthStatus = useContextSelector(AuthContext, (ctx) => ctx.checkAuthStatus);
  const clearSessionExpired = useContextSelector(AuthContext, (ctx) => ctx.clearSessionExpired);

  return {
    initialized,
    authRequired,
    authenticated,
    isLoading,
    error,
    sessionExpired,
    login,
    logout,
    checkAuthStatus,
    clearSessionExpired,
  };
}
