import React, { useState } from 'react';
import { Info, Loader2, Network, Plus } from 'lucide-react';

import { SessionInfo } from '@/apiTypes';
import { FieldError } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/sessions';

interface SessionFormProps {
  /** Called after a session is created. */
  onCreated?: () => void;
  /** Dismisses the form. Cancel is only rendered when there is somewhere to go back to. */
  onCancel?: () => void;
  /** Focus the name field when the form appears. */
  autoFocus?: boolean;
}

const formatPlayTime = (info: SessionInfo) => {
  const hours = Math.floor(info.totalPlayDuration / 3600);
  const minutes = Math.floor((info.totalPlayDuration % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * The add-session form. Used both inside the dialog and embedded in the welcome
 * card, so it renders no title of its own.
 */
export const SessionForm: React.FC<SessionFormProps> = ({ onCreated, onCancel, autoFocus }) => {
  const { createSession, previewSession } = useSession();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; address?: string; form?: string }>({});
  const [testResult, setTestResult] = useState<{ success: boolean; info?: SessionInfo } | null>(
    null
  );

  const handleTest = async () => {
    if (!address.trim()) {
      setErrors({ address: 'Required' });
      return;
    }

    setIsTesting(true);
    setErrors({});
    setTestResult(null);

    try {
      const info = await previewSession(address.trim());
      setTestResult({ success: true, info });

      if (!name.trim() && info.sessionName) {
        setName(info.sessionName);
      }
    } catch (err) {
      setTestResult({ success: false });
      // A failed probe is about the address, so it belongs on that field.
      setErrors({ address: err instanceof Error ? err.message : 'Could not reach this server' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreate = async () => {
    const found: { name?: string; address?: string } = {};
    if (!name.trim()) {
      found.name = 'Required';
    }
    if (!address.trim()) {
      found.address = 'Required';
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setIsCreating(true);
    setErrors({});

    try {
      await createSession(name.trim(), address.trim());
      onCreated?.();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to create session' });
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

      <div className="grid gap-2">
        <Label htmlFor="session-name">Name</Label>
        <Input
          id="session-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Factory"
          autoFocus={autoFocus}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'session-name-error' : undefined}
        />
        <FieldError id="session-name-error" message={errors.name} />
      </div>

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
            setTestResult(null);
            setErrors((prev) => ({ ...prev, address: undefined }));
          }}
          placeholder="192.168.1.100:8080"
          aria-invalid={!!errors.address}
          aria-describedby={errors.address ? 'server-address-error' : undefined}
        />
        <FieldError id="server-address-error" message={errors.address} />
      </div>

      <div
        className={cn(
          'grid transition-all duration-300',
          testResult?.success && testResult?.info
            ? 'grid-rows-[1fr] opacity-100'
            : // A zero-height flex child still gets a gap on each side, so cancel
              // one of them while collapsed.
              '-mb-4 grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <Card className="border py-3">
            <CardContent className="space-y-2 px-4 py-0">
              <p className="text-sm font-medium text-green-500">Connection Successful</p>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Save Name</span>
                  <span className="text-sm">{testResult?.info?.sessionName}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Play Time</span>
                  <span className="text-sm">
                    {testResult?.info?.totalPlayDurationText ||
                      (testResult?.info && formatPlayTime(testResult.info))}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">In-Game Days</span>
                  <span className="text-sm">{testResult?.info?.passedDays}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="outline" onClick={handleTest} disabled={isTesting || !address.trim()}>
          {isTesting ? <Loader2 className="size-4 animate-spin" /> : <Network className="size-4" />}
          {isTesting ? 'Testing...' : 'Test'}
        </Button>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {isCreating ? 'Adding...' : 'Add'}
        </Button>
      </div>
    </div>
  );
};
