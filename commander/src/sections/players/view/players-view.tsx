import {
  Box,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { Grid2 as Grid } from '@mui/material';

import { DashboardContent } from 'src/layouts/dashboard';
import { ApiContext } from 'src/contexts/api/useApi';
import { fNumber } from 'src/utils/format-number';
import { useContextSelector } from 'use-context-selector';

const HealthBar = ({ health }: { health: number }) => {
  const getColor = () => {
    if (health > 80) return 'success';
    if (health > 50) return 'warning';
    return 'error';
  };

  return (
    <>
      <LinearProgress
        variant="determinate"
        value={health}
        sx={{ marginTop: '10px' }}
        color={getColor()}
      />
      <Typography sx={{ mt: 1 }}>{fNumber(health, { decimals: 0 })} / 100</Typography>
    </>
  );
};

const FavoriteItem = ({ item }: { item: { name: string; count: number } }) => {
  return (
    <Card sx={{ marginTop: '20px' }} variant="outlined">
      <CardHeader title="Favorite Item" />
      {/* Center horizontal and verical */}
      <CardContent
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <img
          src={`assets/images/satisfactory/64x64/${item.name}.png`}
          alt={item.name}
          style={{
            width: '50px',
            height: '50px',
          }}
        />{' '}
        <Stack direction="row" spacing={2}>
          <Typography variant="button">{fNumber(item.count)}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

// "pingMs" should be in the top right corner always
export function PlayersView() {
  const api = useContextSelector(ApiContext, (v) => {
    return { players: v.players };
  });

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={2} sx={{ marginBottom: '30px' }}>
        {api.players.map((player) => (
          <Card
            key={player.id} // Ensure a unique key for each card
            sx={{
              padding: '20px',
              marginBottom: '20px',
              minWidth: 400,
              position: 'relative', // Add this for the relative positioning context
            }}
            variant="outlined"
          >
            <CardHeader title={player.name} />
            <CardContent>
              <HealthBar health={player.health} />
              <FavoriteItem item={player.items[0]} />
            </CardContent>
          </Card>
        ))}
      </Grid>
    </DashboardContent>
  );
}
