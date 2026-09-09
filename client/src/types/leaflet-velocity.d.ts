import * as L from 'leaflet';

declare module 'leaflet' {
  interface VelocityLayerOptions extends L.LayerOptions {
    displayValues?: boolean;
    displayOptions?: Record<string, unknown>;
    data: unknown;
    velocityScale?: number;
    colorScale?: string[];
    minVelocity?: number;
    maxVelocity?: number;
  }
  function velocityLayer(options: VelocityLayerOptions): L.Layer;
}

declare module 'leaflet-velocity';
