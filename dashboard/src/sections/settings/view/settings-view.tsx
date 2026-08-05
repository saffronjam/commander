import { CheckCircle, Palette, Terminal } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useTheme } from '@/components/theme-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

import { Settings } from 'src/apiTypes';
import { settingsApi } from 'src/services/settingsApi';

import { AccessKeyCard } from './access-key-card';

/**
 * Settings view: access key management, log level, and theme.
 */
export const SettingsView = () => {
  // Theme state
  const { theme, setTheme } = useTheme();

  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logLevel, setLogLevel] = useState<string>('Info');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const logLevels = ['Trace', 'Debug', 'Info', 'Warning', 'Error'];

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentSettings = await settingsApi.get();
        setSettings(currentSettings);
        setLogLevel(currentSettings.logLevel);
      } catch (err) {
        setSettingsError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  const handleSettingsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);
    setIsUpdatingSettings(true);

    try {
      const updatedSettings = await settingsApi.update({ logLevel: logLevel as any });
      setSettings(updatedSettings);
      setSettingsSuccess('Settings updated successfully.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AccessKeyCard />

        {/* Log Level - Right Side */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="size-5" />
              Log Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            {settingsError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{settingsError}</AlertDescription>
              </Alert>
            )}

            {settingsSuccess && (
              <Alert className="mb-4 border-green-500/50 bg-green-500/10">
                <CheckCircle className="size-4 text-green-500" />
                <AlertDescription className="text-green-500">{settingsSuccess}</AlertDescription>
              </Alert>
            )}

            {isLoadingSettings ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-6" />
              </div>
            ) : (
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="log-level">Log Level</Label>
                  <Select
                    value={logLevel}
                    onValueChange={setLogLevel}
                    disabled={isUpdatingSettings}
                  >
                    <SelectTrigger id="log-level" className="w-full">
                      <SelectValue placeholder="Select log level" />
                    </SelectTrigger>
                    <SelectContent>
                      {logLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isUpdatingSettings || logLevel === settings?.logLevel}
                >
                  {isUpdatingSettings && <Spinner className="mr-2" />}
                  {isUpdatingSettings ? 'Updating...' : 'Update Settings'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Appearance - Third Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme" className="w-full">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
