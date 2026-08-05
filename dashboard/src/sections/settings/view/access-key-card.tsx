import { Check, ChevronDown, Eye, EyeOff, Lock, ShieldOff, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { FieldError } from '@/components/form-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useAuth } from 'src/contexts/auth/useAuth';
import { authApi } from '@/services/authApi';

const MIN_KEY_LENGTH = 8;
const SAVED_LABEL_DURATION = 2500;

type FieldName = 'current' | 'next' | 'confirm';
type Errors = Partial<Record<FieldName | 'form', string>>;

/**
 * Routes a server message to the field it is about, so the caller sees it next to
 * the input they need to fix rather than as a banner.
 */
function fieldForMessage(message: string): FieldName | 'form' {
  const text = message.toLowerCase();
  if (text.includes('current access key')) {
    return 'current';
  }
  if (text.includes('at least') || text.includes('access key must')) {
    return 'next';
  }
  return 'form';
}

interface SecretFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  autoComplete?: string;
}

function SecretField({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
  autoComplete,
}: SecretFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          <span className="sr-only">{visible ? `Hide ${label}` : `Show ${label}`}</span>
        </Button>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * Access key management. An open instance can add a key; a protected one can
 * change it, or remove it from the split button's menu. Every one of these
 * revokes existing sessions server-side.
 */
export function AccessKeyCard() {
  const { authRequired, checkAuthStatus } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [pending, setPending] = useState<'save' | 'remove' | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    },
    []
  );

  /** Shows a confirmation on the button itself, then fades back to its label. */
  const flashSaved = (label: string) => {
    setSavedLabel(label);
    if (savedTimer.current) {
      clearTimeout(savedTimer.current);
    }
    savedTimer.current = setTimeout(() => setSavedLabel(null), SAVED_LABEL_DURATION);
  };

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const run = async (
    label: string,
    action: () => Promise<{ success: boolean; message: string }>
  ) => {
    setErrors({});
    try {
      const result = await action();
      if (!result.success) {
        const message = result.message || 'Something went wrong';
        setErrors({ [fieldForMessage(message)]: message });
        return;
      }
      reset();
      flashSaved(label);
      await checkAuthStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setErrors({ [fieldForMessage(message)]: message });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const found: Errors = {};
    if (authRequired && !current) {
      found.current = 'Required';
    }
    if (next.length < MIN_KEY_LENGTH) {
      found.next = `Use at least ${MIN_KEY_LENGTH} characters`;
    }
    if (next !== confirm) {
      found.confirm = 'The access keys do not match';
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setPending('save');
  };

  const confirmSave = async () => {
    setPending(null);
    setSubmitting(true);
    await run('Access key saved', () =>
      authRequired ? authApi.changePassword(current, next) : authApi.enableAuth(next)
    );
    setSubmitting(false);
  };

  const confirmRemove = async () => {
    setPending(null);
    setRemoving(true);
    await run('Access key removed', () => authApi.disableAuth(current));
    setRemoving(false);
  };

  const busy = submitting || removing;
  const submitLabel = authRequired ? 'Change access key' : 'Set access key';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-5" />
          {authRequired ? 'Access Key' : 'Add an Access Key'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errors.form && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}

        {/* Collapses rather than disappearing, so switching to a protected
            instance eases the warning out instead of snapping the card shorter. */}
        <div
          className={cn(
            'grid transition-all duration-300',
            authRequired ? 'grid-rows-[0fr] opacity-0' : 'mb-4 grid-rows-[1fr] opacity-100'
          )}
        >
          <div className="overflow-hidden">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <ShieldOff className="size-4 text-amber-500" />
              <AlertDescription className="text-amber-500">
                This dashboard has no access key. Anyone who can reach this address can view your
                factory and change its sessions.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Appears the same way once a key exists. */}
          <div
            className={cn(
              'grid transition-all duration-300',
              authRequired ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
          >
            <div className="overflow-hidden">
              <SecretField
                id="current-access-key"
                label="Current access key"
                value={current}
                onChange={setCurrent}
                disabled={busy}
                error={errors.current}
                autoComplete="current-password"
              />
            </div>
          </div>

          <SecretField
            id="new-access-key"
            label={authRequired ? 'New access key' : 'Access key'}
            value={next}
            onChange={setNext}
            disabled={busy}
            error={errors.next}
            autoComplete="new-password"
          />

          <SecretField
            id="confirm-access-key"
            label="Confirm access key"
            value={confirm}
            onChange={setConfirm}
            disabled={busy}
            error={errors.confirm}
            autoComplete="new-password"
          />

          <div className="flex w-full">
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className={cn('relative flex-1', authRequired && 'rounded-r-none')}
            >
              {/* Two stacked labels crossfade, so the confirmation replaces the
                  label in place without the button resizing. */}
              <span
                className={cn(
                  'flex items-center gap-2 transition-opacity duration-300',
                  savedLabel && 'opacity-0'
                )}
              >
                {submitting && <Spinner className="size-4" />}
                {submitLabel}
              </span>
              <span
                aria-live="polite"
                className={cn(
                  'absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-300',
                  savedLabel ? 'opacity-100' : 'opacity-0'
                )}
              >
                {savedLabel && <Check className="size-4" />}
                {savedLabel}
              </span>
            </Button>

            {authRequired && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  disabled={busy}
                  aria-label="More access key actions"
                  className="border-primary-foreground/20 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md rounded-l-none border-l px-3 focus:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <ChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!current}
                    onSelect={() => setPending('remove')}
                  >
                    <Trash2 className="size-4" />
                    Remove access key
                  </DropdownMenuItem>
                  {!current && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Enter your current access key first.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </form>
      </CardContent>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === 'remove' ? 'Remove the access key?' : `${submitLabel}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === 'remove'
                ? 'The dashboard will be open to anyone who can reach this address, with no sign-in. Everyone signed in is signed out, and you can set a new key at any time.'
                : 'Everyone signed in will need to sign in again with the new key, on every device.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={pending === 'remove' ? confirmRemove : confirmSave}
              className={cn(
                pending === 'remove' &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
            >
              {pending === 'remove' ? 'Remove access key' : submitLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
