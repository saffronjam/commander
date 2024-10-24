export type Alert = {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
};
