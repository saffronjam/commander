import React, { useEffect, useState } from 'react';
import { Snackbar, IconButton, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ApiContext } from './useApi';
import { useContextSelector } from 'use-context-selector';

export const ConnectionCheckerProvider: React.FC<any> = () => {
  type AlertProps = {
    severity: 'success' | 'error' | 'info' | 'warning' | undefined;
    message: string;
  };

  const upMessage = 'Satifactory API is online';
  const downMessage = 'Satifactory API is offline';

  const isOnline = useContextSelector(ApiContext, (v) => {
    return v.isOnline;
  });
  const [props, setProps] = useState<AlertProps>({ severity: 'success', message: upMessage });
  const [open, setOpen] = useState<boolean>(false);
  const [didFirstCheck, setDidFirstCheck] = useState<boolean>(false);

  const checkApiConnection = async () => {
    if (!didFirstCheck) {
      setDidFirstCheck(true);
      return;
    }

    const up = isOnline;
    let newMessage = '';
    let newSeverity: 'success' | 'error' | 'info' | 'warning' | undefined;

    if (up) {
      newMessage = upMessage;
      newSeverity = 'success';
    } else {
      newMessage = downMessage;
      newSeverity = 'error';
    }

    setProps({ severity: newSeverity, message: newMessage });
    setOpen(true);
    if (newSeverity !== 'error') {
      setTimeout(() => {
        setOpen(false);
      }, 5000);
    }
  };

  useEffect(() => {
    checkApiConnection();
  }, [isOnline]);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason !== 'clickaway') {
      setOpen(false);
    }
  };

  // console.log('render ConnectionCheckerProvider');
  return (
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={open}
      autoHideDuration={props?.severity !== 'error' ? 2000 : null}
      onClose={handleClose}
    >
      <Alert
        severity={props?.severity}
        action={
          <IconButton aria-label="close" color="inherit" size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {props?.message}
      </Alert>
    </Snackbar>
  );
};
