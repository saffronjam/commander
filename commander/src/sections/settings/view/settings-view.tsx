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

            <Card variant="outlined" sx={{ marginTop: '20px' }}>
              <CardContent>
                <Typography variant="h5">Preferences</Typography>

                {/* rerender select */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                  }}
                >
                  <Select
                    sx={{ marginTop: '15px', boxShadow: 'none', minWidth: '120px' }}
                    value={settings.intervals.rerender}
                    onChange={(e) => {
                      const newInterval = Number(e.target.value);
                      saveSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          rerender: newInterval,
                        },
                      });
                    }}
                  >
                    <MenuItem value={250}>250ms</MenuItem>
                    <MenuItem value={500}>500ms</MenuItem>
                    <MenuItem value={1000}>1s</MenuItem>
                    <MenuItem value={2000}>2s</MenuItem>
                    <MenuItem value={5000}>5s</MenuItem>
                  </Select>
                  <Typography variant="body2" marginTop={'15px'} sx={{ marginLeft: '10px' }}>
                    Re-render
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h5">Data Interval Speed</Typography>
                {Object.keys(settings.intervals)
                  .filter((k) => k != 'rerender')
                  .map((key) => {
                    return (
                      <Box
                        key={key}
                        sx={{
                          display: 'flex',
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                        }}
                      >
                        <Select
                          sx={{ marginTop: '15px', boxShadow: 'none', minWidth: '120px' }}
                          value={settings.intervals[key as keyof Settings['intervals']]}
                          onChange={(e) => {
                            const newInterval = Number(e.target.value);
                            saveSettings({
                              ...settings,
                              intervals: {
                                ...settings.intervals,
                                [key]: newInterval,
                              },
                            });
                          }}
                        >
                          <MenuItem value={250}>250ms</MenuItem>
                          <MenuItem value={500}>500ms</MenuItem>
                          <MenuItem value={1000}>1s</MenuItem>
                          <MenuItem value={2000}>2s</MenuItem>
                          <MenuItem value={5000}>5s</MenuItem>
                        </Select>
                        <Typography variant="body2" marginTop={'15px'} sx={{ marginLeft: '10px' }}>
                          {intervalKeyToDisplay(key)}
                        </Typography>
                      </Box>
                    );
                  })}
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
