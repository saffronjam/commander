import { Machine } from 'src/apiTypes';

export type Settings = {
  apiUrl: string;
  productionView: {
    includeMinable: boolean;
    includeItems: boolean;
    showTrend: boolean;
  };
};

export type MachineGroup = {
  hash: string;
  machines: Machine[];
  center: { x: number; y: number };

  powerConsumption: number;
  powerProduction: number;

  itemProduction: {
    [key: string]: number;
  };
  itemConsumption: {
    [key: string]: number;
  };
};
