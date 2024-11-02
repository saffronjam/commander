import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material';
import {
  Card,
  CardContent,
  Container,
  Typography,
  Grid2 as Grid,
  Select,
  MenuItem,
  Button,
  TextField,
  Box,
} from '@mui/material';
import { useState } from 'react';
import { sentenceCase } from 'sentence-case';
import { Iconify } from 'src/components/iconify';
import { useSettings } from 'src/hooks/use-settings';
import { Settings } from 'src/types';

const intervalKeyToDisplay = (key: string) => {
  switch (key) {
    case 'satisfactoryApiCheck':
      return 'Satisfactory API Check';
    case 'rerender':
      return 'Re-render';
    default:
      return sentenceCase(key);
  }
};

export const SettingsView = () => {
  const theme = useTheme();
  const { settings, saveSettings, defaultSettings } = useSettings();
  const [revertConfirmOpen, setOpen] = useState(false);

  const revertConfirmHandleOpen = () => {
    setOpen(true);
  };

  const revertConfirmHandleClose = () => {
    setOpen(false);
  };

  const revertConfirmHandleConfirm = () => {
    saveSettings(defaultSettings);
    revertConfirmHandleClose();
  };

  return (
    <>
      <Container>
        <Card variant="outlined" sx={{ marginTop: '40px', marginBottom: '30px' }}>
          <CardContent>
            <Grid container>
              <Grid size={{ xs: 3 }}>
                <Typography variant="h3">Settings</Typography>
              </Grid>
              {/* right side */}
              <Grid size={{ xs: 9 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Tooltip title="Reset to Default Settings">
                  <IconButton sx={{ marginRight: '10px' }} onClick={revertConfirmHandleOpen}>
                    <Iconify icon="bi:arrow-counterclockwise" />
                  </IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Grid container spacing={2} sx={{ marginBottom: '30px' }}>
          <Grid>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h5">API URL</Typography>
                <TextField
                  sx={{ marginTop: '15px', minWidth: '300px' }}
                  defaultValue={settings.apiUrl}
                  onBlur={(e) => {
                    saveSettings({ ...settings, apiUrl: e.target.value });
                  }}
                  disabled
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h5">Preferences</Typography>
                <Typography variant="body2" sx={{ marginTop: '15px' }}>
                  Coming Soon
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2">All Changes have immediate effect.</Typography>
          </CardContent>
        </Card>
      </Container>

      <Dialog open={revertConfirmOpen} onClose={revertConfirmHandleClose}>
        <DialogTitle>Reset Settings?</DialogTitle>
        <DialogContent>
          <DialogContentText>This can not be undone</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={revertConfirmHandleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={revertConfirmHandleConfirm} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
