import { Icon } from '@iconify/react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FieldError } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { useAuth } from 'src/contexts/auth/useAuth';
import { authApi } from 'src/services/authApi';

/**
 * First-run setup. Claims the instance with the setup token the server printed,
 * and optionally sets an access key. Skipping the key leaves the instance open
 * to anyone who can reach it, so the choice is stated rather than defaulted.
 */
export function SetupView() {
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuth();

  const [setupToken, setSetupToken] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<{ token?: string; key?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState<'key' | 'open' | null>(null);

  // Setup has exactly two things that can be wrong, and the server names which.
  const report = (message: string) => {
    const text = message.toLowerCase();
    if (text.includes('setup token')) {
      setErrors({ token: message });
    } else if (text.includes('access key')) {
      setErrors({ key: message });
    } else {
      setErrors({ form: message });
    }
  };

  const complete = async (withKey: boolean) => {
    setErrors({});
    setSubmitting(withKey ? 'key' : 'open');
    try {
      const result = await authApi.completeSetup(setupToken.trim(), withKey ? accessKey : null);
      if (!result.success) {
        report(result.message || 'Setup failed');
        return;
      }
      await checkAuthStatus();
      navigate('/', { replace: true });
    } catch (err) {
      report(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSubmitting(null);
    }
  };

  const busy = submitting !== null;
  const canSubmit = setupToken.trim().length > 0 && !busy;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="px-8">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
            <Icon icon="material-symbols:factory" className="size-10 text-primary" />
          </div>

          <h1 className="mb-8 text-center text-2xl font-bold">Welcome to Satisfactory Dashboard</h1>

          {errors.form && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errors.form}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) void complete(accessKey.length > 0);
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="setup-token">Setup token</Label>
              <Input
                id="setup-token"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                disabled={busy}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!errors.token}
                aria-describedby={errors.token ? 'setup-token-error' : undefined}
                className="font-mono"
              />
              <FieldError id="setup-token-error" message={errors.token} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="access-key">Access key</Label>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3" />
                  Recommended
                </span>
              </div>
              <div className="relative">
                <Input
                  id="access-key"
                  type={showKey ? 'text' : 'password'}
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  disabled={busy}
                  autoComplete="new-password"
                  placeholder="Optional"
                  aria-invalid={!!errors.key}
                  aria-describedby={errors.key ? 'access-key-error' : undefined}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowKey((prev) => !prev)}
                  disabled={busy}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  <span className="sr-only">{showKey ? 'Hide access key' : 'Show access key'}</span>
                </Button>
              </div>
              <FieldError id="access-key-error" message={errors.key} />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                disabled={!canSubmit || accessKey.length === 0}
                className="w-full"
              >
                {submitting === 'key' && <Spinner className="mr-2" />}
                Set access key and continue
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!canSubmit}
                onClick={() => void complete(false)}
                className="w-full"
              >
                {submitting === 'open' && <Spinner className="mr-2" />}
                Continue without a key
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
