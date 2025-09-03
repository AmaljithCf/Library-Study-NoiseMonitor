
export interface Area {
  id: string;
  name: string;
  deviceId: string;
  icon: string;
  lastUpdated: Date;
  isMuted: boolean;
  alert: boolean;
  noise_level?: number;
  alert_reason?: string;
}

export interface NoiseData {
  deviceId: string;
  noiseLevel: number;
  timestamp: number;
}

export type MqttConfig = {
  protocol: 'ws' | 'wss';
  broker: string;
  port: number;
  username: string;
  password?: string;
};
