import { LatLngBounds, LatLngExpression } from 'leaflet';

// Bounds found at https://github.dev/AnthorNet/SC-InteractiveMap/tree/dev/src
export const MapBounds = new LatLngBounds([80, -80], [-240, 240]);
// export const MapBounds = new LatLngBounds([0, 0], [256, 256]);

export const ConvertToMapCoords = (x: number, y: number): LatLngExpression => {
  const xRange = 142;
  const yRange = 161;

  const xFactor = 5900;
  const yFactor = 5900;
  const unitSystem = { x: x / xFactor, y: y / yFactor };

  return [-unitSystem.y - yRange / 2, unitSystem.x + xRange / 2];
};

export const ConvertToMapCoords2 = (x: number, y: number): LatLngExpression => {
  const sourceTopLeft = { x: -324698.832031, y: -375000 };
  const sourceBottomRight = { x: 425301.832031, y: 375000 };

  const targetTopLeft = { x: 16, y: -16 };
  const targetBottomRight = { x: 144, y: -144 };

  const xRatio = (x-sourceTopLeft.x) / (sourceBottomRight.x - sourceTopLeft.x);
  const yRatio = (y-sourceTopLeft.y) / (sourceBottomRight.y - sourceTopLeft.y);

  const translatedX = targetTopLeft.x + xRatio * (targetBottomRight.x - targetTopLeft.x);
  const translatedY = targetTopLeft.y + yRatio * (targetBottomRight.y - targetTopLeft.y);

  return [translatedY, translatedX];
};
