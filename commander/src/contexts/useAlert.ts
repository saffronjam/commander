import { createContext } from 'react';
import { Alert } from 'src/types';

type AlertContextType = {
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;
};

export const AlertContext = createContext<AlertContextType | undefined>(undefined);
