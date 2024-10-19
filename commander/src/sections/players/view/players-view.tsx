import { useState } from 'react';

import { DashboardContent } from 'src/layouts/dashboard';

export function PlayersView() {
  const [players, setPlayers] = useState([
    { id: '1', name: 'Player 1', hp: 100, color: 'red', pingMs: 50 },
    { id: '2', name: 'Player 2', hp: 100, color: 'blue', pingMs: 100 },
  ] as any[]);

  return (
    <DashboardContent maxWidth="xl">
      {players.map((player) => (
        // <PlayerStats key={player.id} player={player} />
        <div key={player.id}>
          <div>{player.name}</div>
          <div>{player.hp}</div>
          <div>{player.color}</div>
          <div>{player.pingMs}</div>
        </div>
      ))}
    </DashboardContent>
  );
}
