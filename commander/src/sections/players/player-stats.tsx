import { Card, Typography } from '@mui/material';

export default function PlayerStats({ player }: { player: any }) {
  return (
    <Card>
      <Typography variant="h5">Player Stats</Typography>
      <Typography variant="body1">Player: {player.name}</Typography>
      <Typography variant="body1">HP: {player.hp}</Typography>
      <Typography variant="body1">Color: {player.color}</Typography>
    </Card>
  );
}
