import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAndParse } from './ApiProvider';
import { useNotifications } from '@toolpad/core';
import { useSettings } from 'src/hooks/use-settings';

export type Info = {
  checkApiConnection: () => void;
};

export const defaultValues: Info = {
  checkApiConnection: () => {},
};

export const ConnectionCheckerContext = createContext<Info>(defaultValues);

export const ConnectionCheckerProvider: React.FC<any> = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const currentNotification = useRef<{ id: string; message: string } | null>(null);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const { show, close } = useNotifications();
  const { settings } = useSettings();

  const checkApiConnection = async () => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }

    fetchAndParse('/api/satisfactoryApiCheck')
      .catch(() => {
        return { up: false };
      })
      .then(({ up }: { up: boolean }) => {
        let newMessage = '';
        let newSeverity: 'success' | 'error' | 'info' | 'warning' | undefined;

        if (up) {
          newMessage = 'Satifactory API is online';
          newSeverity = 'success';
        } else {
          newMessage = 'Satifactory API is offline';
          newSeverity = 'error';
        }

        if (newMessage && newSeverity) {
          if (currentNotification.current) {
            if (currentNotification.current.message !== newMessage) {
              close(currentNotification.current.id);
            }

            if (currentNotification.current.message === newMessage) {
              return;
            }
          }

          const newId = show(newMessage, {
            severity: newSeverity,
          });

          currentNotification.current = { id: newId, message: newMessage };
        }
      });

    timeoutId.current = setTimeout(checkApiConnection, settings.intervals.satisfactoryApiCheck);
  };

  useEffect(() => {
    if (settings.intervals.satisfactoryApiCheck) {
      checkApiConnection();
    }
    checkApiConnection();
  }, [settings]);

  const state = useMemo(
    () => ({
      checkApiConnection,
    }),
    []
  );

  return (
    <ConnectionCheckerContext.Provider value={state}>{children}</ConnectionCheckerContext.Provider>
  );
};
