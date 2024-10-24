import { Button, Alert, Container } from '@mui/material';
import { Box } from '@mui/system';
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAndParse } from './ApiProvider';
import { on } from 'events';
import { useNotifications } from '@toolpad/core';

export type Info = {
  msInterval: number;
  checkApiConnection: () => void;
};

export const defaultValues: Info = {
  msInterval: 1000,
  checkApiConnection: () => {},
};

export const ConnectionCheckerContext = createContext<Info>(defaultValues);

export const ConnectionCheckerProvider: React.FC<any> = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { show, close } = useNotifications();
  const [online, setOnline] = useState(false);

  let timeoutId: NodeJS.Timeout;

  const currentNotification = useRef<{ id: string; message: string } | null>(null);

  const [msInterval, setMsInterval] = useState(1000);

  const checkApiConnection = async () => {
    clearTimeout(timeoutId);

    fetchAndParse('/api/satisfactoryApiCheck')
      .catch(() => {
        return { up: false };
      })
      .then(({ up }: { up: boolean }) => {
        let newMessage = '';
        let newSeverity: 'success' | 'error' | 'info' | 'warning' | undefined;

        if (up) {
          const message = 'Satifactory API is online';

          if (currentNotification.current) {
            if (currentNotification.current.message !== message) {
              close(currentNotification.current.id);
            }

            if (currentNotification.current.message === message) {
              return;
            }
          }

          newMessage = message;
          newSeverity = 'success';
        } else {
          const message = 'Satifactory API is offline';

          if (currentNotification.current) {
            if (currentNotification.current.message !== message) {
              close(currentNotification.current.id);
            }

            if (currentNotification.current.message === message) {
              return;
            }
          }

          newMessage = message;
          newSeverity = 'error';
        }

        if (newMessage && newSeverity) {
          const newId = show(newMessage, {
            severity: newSeverity,
          });

          currentNotification.current = { id: newId, message: newMessage };
        }
      });

    timeoutId = setTimeout(checkApiConnection, 1000);
  };

  useEffect(() => {
    checkApiConnection();
  }, []);

  const state = useMemo(
    () => ({
      msInterval: msInterval,
      checkApiConnection: checkApiConnection,
    }),
    [msInterval]
  );

  return (
    <ConnectionCheckerContext.Provider value={state}>{children}</ConnectionCheckerContext.Provider>
  );
};
