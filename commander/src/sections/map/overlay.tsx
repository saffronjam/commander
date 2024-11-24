import { Marker, useMapEvents } from 'react-leaflet';
import { groupMachines } from './utils';
import { Machine, MachineCategory } from 'common/types';
import { useEffect, useState } from 'react';
import { ConvertToMapCoords2 } from './bounds';
import L from 'leaflet';

type MachineGroup = {
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

const computeMachineGroups = (machines: Machine[], groupDistance: number) => {
  const groups = groupMachines(machines, groupDistance);
  console.log(`found ${groups.length} groups`);

  return groups.map((machines) => {
    const center = {
      x: machines.reduce((acc, m) => acc + m.location.x, 0) / machines.length,
      y: machines.reduce((acc, m) => acc + m.location.y, 0) / machines.length,
    };
    const powerConsumption = machines.reduce((acc, m) => {
      if (m.category === MachineCategory.generator) return acc;
      return acc + (m.input.find((i) => i.name === 'Power')?.current || 0);
    }, 0);
    const powerProduction = machines.reduce((acc, m) => {
      if (m.category !== MachineCategory.generator) return acc;
      return acc + (m.output.find((i) => i.name === 'Power')?.current || 0);
    }, 0);

    const itemProduction: { [key: string]: number } = {};
    const itemConsumption: { [key: string]: number } = {};

    machines.forEach((m) => {
      m.output.forEach((p) => {
        if (p.name === 'Power') return;

        if (itemProduction[p.name] === undefined) {
          itemProduction[p.name] = 0;
        }
        itemProduction[p.name] += p.current;
      });

      m.input.forEach((i) => {
        if (i.name === 'Power') return;

        if (itemConsumption[i.name] === undefined) {
          itemConsumption[i.name] = 0;
        }
        itemConsumption[i.name] += i.current;
      });
    });

    return {
      machines,
      center,
      powerConsumption,
      powerProduction,
      itemProduction,
      itemConsumption,
    } as MachineGroup;
  });
};

const zoomToGroupDistance = (zoom: number) => {
  zoom = Math.floor(zoom);
  switch (zoom) {
    case 3:
      return 12000;
    case 4:
      return 8000;
    case 5:
      return 4000;
    case 6:
      return 100;
    case 7:
      return 0;
    case 8:
      return 0;
    default:
      return 0;
  }
};

type IconProps = {
  size: string;
  color: string;
  backgroundColor: string;
  padding: string;
};

const iconifyFactory = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path fill="currentColor" d="M2 22V9.975L9 7v2l5-2v3h8v12zm9-4h2v-4h-2zm-4 0h2v-4H7zm8 0h2v-4h-2zm6.8-9.5h-4.625l.85-6.5H21z"/>
      </svg>`;
const iconifyGenerator = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="currentColor" d="M19.836 10.486a.9.9 0 0 1-.21.47l-9.75 10.71a.94.94 0 0 1-.49.33q-.125.015-.25 0a1 1 0 0 1-.41-.09a.92.92 0 0 1-.45-.46a.9.9 0 0 1-.07-.58l.86-6.86h-3.63a1.7 1.7 0 0 1-.6-.15a1.29 1.29 0 0 1-.68-.99a1.3 1.3 0 0 1 .09-.62l3.78-9.45c.1-.239.266-.444.48-.59a1.3 1.3 0 0 1 .72-.21h7.24c.209.004.414.055.6.15c.188.105.349.253.47.43c.112.179.18.38.2.59a1.2 1.2 0 0 1-.1.61l-2.39 5.57h3.65a1 1 0 0 1 .51.16a1 1 0 0 1 .43 1z"/>
     </svg>`;

const FactoryIcon = (props: IconProps) => {
  return Icon(iconifyFactory, props);
};

const GeneratorIcon = (props: IconProps) => {
  return Icon(iconifyGenerator, props);
};

const MultiIcon = (svgs: string[], { size, color, backgroundColor, padding }: IconProps) => {
  const iconHtml = `
    <div color="${color}" style="background-color: ${backgroundColor}; border-radius: 50%; padding: ${padding}; width: ${size}; height: ${size}; display: flex; justify-content: center; align-items: center;">
      ${svgs.map((svg) => `<div>${svg}</div>`).join('')}
    </div>`;
  return L.divIcon({
    className: 'custom-icon',
    html: iconHtml,
    iconAnchor: [12, 24],
  });
};

const Icon = (html: string, { size, color, backgroundColor, padding }: IconProps) => {
  const iconHtml = `
    <div color="${color}" style="background-color: ${backgroundColor}; border-radius: 50%; padding: ${padding}; width: ${size}; height: ${size}; display: flex; justify-content: center; align-items: center;">
      ${html}
    </div>`;
  return L.divIcon({
    className: 'custom-icon',
    html: iconHtml,
    iconAnchor: [12, 24],
  });
};

const iconFromCategories = (
  categories: MachineCategory[],
  { size, color, backgroundColor, padding }: IconProps
) => {
  const svgs: string[] = [];

  if (categories.includes(MachineCategory.extractor)) {
    svgs.push(iconifyFactory);
  }
  if (categories.includes(MachineCategory.factory)) {
    svgs.push(iconifyFactory);
  }
  if (categories.includes(MachineCategory.generator)) {
    svgs.push(iconifyGenerator);
  }

  return MultiIcon(svgs, {
    size,
    color,
    backgroundColor,
    padding,
  });
};

type OverlayProps = {
  machines: Machine[];
};

export function Overlay({ machines }: OverlayProps) {
  const [machineGroups, setMachineGroups] = useState<MachineGroup[]>([]);

  const map = useMapEvents({
    zoomend: () => {
      console.log('zoomend', map.getZoom());
      setMachineGroups(computeMachineGroups(machines, zoomToGroupDistance(map.getZoom())));
    },
  });

  useEffect(() => {
    setMachineGroups(computeMachineGroups(machines, zoomToGroupDistance(map.getZoom())));
  }, [machines]);

  const getCategories = (group: MachineGroup) => {
    const categories: MachineCategory[] = [];
    group.machines.forEach((m) => {
      categories.push(m.category);
    });

    return categories;
  };

  return (
    <>
      {machineGroups.map((group, index) => {
        const position = ConvertToMapCoords2(group.center.x, group.center.y);

        const categories = getCategories(group);

        const icon = iconFromCategories(categories, {
          size: '48px',
          color: 'white',
          backgroundColor: 'black',
          padding: '10px',
        });
        return (
          <Marker
            key={index}
            position={position}
            eventHandlers={{
              click: () => {
                console.log('clicked on group', group);
              },
            }}
            icon={icon}
          />
        );
      })}

      {/* <CircleMarker  center={[0, 0]} radius={10} pathOptions={{ color: 'red' }}/>
      <CircleMarker  center={[-16, 16]} radius={10} pathOptions={{ color: 'red' }}/>
      <CircleMarker  center={[-144, 144]} radius={10} pathOptions={{ color: 'red' }}/>
      <CircleMarker  center={[-160, 160]} radius={10} pathOptions={{ color: 'red' }}/> */}
    </>
  );
}
