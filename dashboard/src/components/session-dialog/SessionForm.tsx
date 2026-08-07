import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Network,
  Plus,
  Radar,
} from 'lucide-react';
import type { CombinedError } from 'urql';

import { SessionInfo } from '@/apiTypes';
import { FieldError } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/contexts/sessions';
import { cn } from '@/lib/utils';
import type { DiscoveredSession } from 'src/services/sessionApi';
import { graphQLFailure } from 'src/utils/graphql-error';
import { probeFailureCopy } from 'src/utils/session-offline';

interface SessionFormProps {
  /** Called after a session is created. */
  onCreated?: () => void;
  /** Dismisses the form. Cancel is only rendered when there is somewhere to go back to. */
  onCancel?: () => void;
  /** Focus the address field when the form appears. */
  autoFocus?: boolean;
}

/**
 * Three ways in, one way out: search the network, or type an address, and either
 * way confirm the save before the session exists.
 *
 * A session is pinned to one save for its lifetime, so the save has to be
 * confirmed before the session can exist. The address is not editable in the
 * confirm step: editing it after a successful probe is what makes a stale probe
 * possible, and going back discards the probe rather than validating against it.
 */
type Phase =
  | { kind: 'discover'; results: DiscoveredSession[] | null }
  | { kind: 'address' }
  | { kind: 'confirm'; address: string; info: SessionInfo };

const formatPlayTime = (info: SessionInfo) => {
  const hours = Math.floor(info.totalPlayDuration / 3600);
  const minutes = Math.floor((info.totalPlayDuration % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/** The server rejects a create whose save no longer matches what was confirmed. */
const observedSaveNameFromError = (err: unknown): string | null => {
  const graphQLErrors = (err as CombinedError)?.graphQLErrors;
  for (const gqlError of graphQLErrors ?? []) {
    if (gqlError.extensions?.code === 'SAVE_NAME_MISMATCH') {
      const observed = gqlError.extensions?.observedSaveName;
      return typeof observed === 'string' ? observed : '';
    }
  }
  return null;
};

/**
 * The add-session form. Used both inside the dialog and embedded in the welcome
 * card, so it renders no title of its own.
 */
export const SessionForm: React.FC<SessionFormProps> = ({ onCreated, onCancel, autoFocus }) => {
  const { createSession, previewSession, discoverSessions } = useSession();

  const [phase, setPhase] = useState<Phase>({ kind: 'discover', results: null });
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [resultIndex, setResultIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; address?: string; form?: string }>({});

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setErrors({});
    try {
      const results = await discoverSessions();
      setResultIndex(0);
      setPhase({ kind: 'discover', results });
    } catch (err) {
      const failure = graphQLFailure(err, 'Could not search the network');
      setErrors({ form: failure.message });
    } finally {
      setIsDiscovering(false);
    }
  };

  // A discovered server was already probed, so choosing one skips straight to the
  // confirm step rather than asking the server the same question twice.
  const handleSelectDiscovered = (result: DiscoveredSession) => {
    setName(result.info.saveName);
    setErrors({});
    setPhase({ kind: 'confirm', address: result.address, info: result.info });
  };

  const handleConnect = async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      setErrors({ address: 'Required' });
      return;
    }

    setIsConnecting(true);
    setErrors({});

    try {
      const info = await previewSession(trimmed);
      setPhase({ kind: 'confirm', address: trimmed, info });
      if (!name.trim()) {
        setName(info.saveName);
      }
    } catch (err) {
      const failure = graphQLFailure(err, 'Could not reach this server');
      if (failure.detail) {
        console.debug('[SessionForm] probe failed:', failure.detail);
      }
      // A failed probe is about the address, so it belongs on that field.
      setErrors({
        address:
          failure.code === 'FRM_UNREACHABLE' ? probeFailureCopy(failure.reason) : failure.message,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBack = () => {
    setPhase({ kind: 'discover', results: null });
    setErrors({});
  };

  const handleCreate = async () => {
    if (phase.kind !== 'confirm') {
      return;
    }
    if (!name.trim()) {
      setErrors({ name: 'Required' });
      return;
    }

    setIsCreating(true);
    setErrors({});

    try {
      await createSession(name.trim(), phase.address, phase.info.saveName);
      onCreated?.();
    } catch (err) {
      const observed = observedSaveNameFromError(err);
      if (observed !== null) {
        // What the confirm step is showing is now known to be wrong, so go back
        // rather than keep displaying it.
        setPhase({ kind: 'address' });
        setErrors({
          form: observed
            ? `The server is now running "${observed}". Connect again to confirm the save.`
            : 'The server changed save. Connect again to confirm the save.',
        });
        return;
      }
      const failure = graphQLFailure(err, 'Failed to create session');
      setErrors({
        form:
          failure.code === 'FRM_UNREACHABLE' ? probeFailureCopy(failure.reason) : failure.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-left">
      {errors.form && (
        <Alert variant="destructive">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      )}

      {phase.kind === 'discover' && (
        <DiscoverStep
          results={phase.results}
          isDiscovering={isDiscovering}
          index={resultIndex}
          onIndexChange={setResultIndex}
          onDiscover={handleDiscover}
          onSelect={handleSelectDiscovered}
          onManual={() => {
            setErrors({});
            setPhase({ kind: 'address' });
          }}
          onCancel={onCancel}
        />
      )}

      {phase.kind === 'address' && (
        <>
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="server-address">FRM Address</Label>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label="About the FRM address"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-full focus:outline-none focus-visible:ring-2"
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-60">
                  Where FRM is running. Your own machine, or the server hosting the game.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="server-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setErrors((prev) => ({ ...prev, address: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleConnect();
                }
              }}
              placeholder="192.168.1.100:8080"
              autoFocus={autoFocus}
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? 'server-address-error' : undefined}
            />
            <FieldError id="server-address-error" message={errors.address} />
          </div>

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={handleConnect} disabled={isConnecting || !address.trim()}>
              {isConnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Network className="size-4" />
              )}
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </>
      )}

      {phase.kind === 'confirm' && (
        <>
          <Card className="border py-3">
            <CardContent className="space-y-2 px-4 py-0">
              <p className="text-sm font-medium text-green-500">Connected</p>

              <div className="space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Address</span>
                  <span className="text-sm truncate">{phase.address}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Save Name</span>
                  <span className="text-sm truncate">{phase.info.saveName}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Total Play Time</span>
                  <span className="text-sm">
                    {phase.info.totalPlayDurationText || formatPlayTime(phase.info)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-sm text-muted-foreground">In-Game Days</span>
                  <span className="text-sm">{phase.info.passedDays}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="grid gap-2">
            <Label htmlFor="session-name">Name</Label>
            <Input
              id="session-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleCreate();
                }
              }}
              placeholder="My Factory"
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'session-name-error' : undefined}
            />
            <FieldError id="session-name-error" message={errors.name} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleBack} disabled={isCreating}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {isCreating ? 'Adding...' : 'Add session'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

interface DiscoverStepProps {
  results: DiscoveredSession[] | null;
  isDiscovering: boolean;
  index: number;
  onIndexChange: (index: number) => void;
  onDiscover: () => void;
  onSelect: (result: DiscoveredSession) => void;
  onManual: () => void;
  onCancel?: () => void;
}

/**
 * The network-search step.
 *
 * Results are paged one at a time rather than listed: the dialog is a fixed
 * width, and a list would grow it as far as the number of servers found.
 */
const DiscoverStep: React.FC<DiscoverStepProps> = ({
  results,
  isDiscovering,
  index,
  onIndexChange,
  onDiscover,
  onSelect,
  onManual,
  onCancel,
}) => {
  if (results === null) {
    return (
      <>
        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={onDiscover} disabled={isDiscovering}>
            {isDiscovering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            {isDiscovering ? 'Searching...' : 'Discover'}
          </Button>
          <Button variant="ghost" className="w-fit self-center" onClick={onManual}>
            or enter an address
          </Button>
        </div>
        {onCancel && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </>
    );
  }

  if (results.length === 0) {
    return (
      <>
        <Card className="border py-3">
          <CardContent className="px-4 py-0">
            <p className="text-sm font-medium">Nothing found on your network</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Make sure the game is running with Ficsit Remote Monitoring enabled, or enter the
              address yourself.
            </p>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="outline" onClick={onDiscover} disabled={isDiscovering}>
            {isDiscovering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            Search again
          </Button>
          <Button onClick={onManual}>Enter an address</Button>
        </div>
      </>
    );
  }

  const current = results[Math.min(index, results.length - 1)];

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Found {results.length} {results.length === 1 ? 'server' : 'servers'} on your network.
      </p>

      <Card className={cn('border py-3', current.alreadyAdded && 'opacity-60')}>
        <CardContent className="space-y-2 px-4 py-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{current.info.saveName}</p>
              <p className="truncate text-sm text-muted-foreground">{current.address}</p>
            </div>
            {current.alreadyAdded ? (
              <Badge variant="secondary">Already added</Badge>
            ) : (
              <Button size="sm" onClick={() => onSelect(current)}>
                Select
              </Button>
            )}
          </div>

          {results.length > 1 && (
            <div className="flex items-center justify-end gap-1 pt-1">
              <span className="mr-1 text-xs text-muted-foreground">
                {Math.min(index, results.length - 1) + 1} of {results.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous server"
                disabled={index <= 0}
                onClick={() => onIndexChange(index - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next server"
                disabled={index >= results.length - 1}
                onClick={() => onIndexChange(index + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onManual}>
          or enter an address
        </Button>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="outline" onClick={onDiscover} disabled={isDiscovering}>
            {isDiscovering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            Search again
          </Button>
        </div>
      </div>
    </>
  );
};
