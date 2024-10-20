import { useColorScheme } from '@mui/joy';
import { useEffect } from 'react';

export const ToggleTheme: React.FC<any> = ({ children }: any) => {
  const { setMode } = useColorScheme();

  useEffect(() => {
    setMode('dark');
  }, [setMode]);

  return <>{children}</>;
};
