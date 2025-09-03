import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import mqtt from 'mqtt';
import { useToast } from '@/hooks/use-toast';
import { Area, MqttConfig, NoiseData } from '@/types';

const MAX_HISTORY_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const MAX_HISTORY_POINTS = 10000; // Limit the number of data points

// Define the shape of the context state
interface MqttContextType {
  isConnected: boolean;
  isConnecting: boolean;
  areas: Area[];
  mqttConfig: MqttConfig;
  savedConfigs: MqttConfig[];
  connect: () => Promise<void>;
  disconnect: () => void;
  setMqttConfig: (config: MqttConfig) => void;
  saveConfig: () => void;
  publish: (topic: string, message: string) => void;
  addArea: (area: Omit<Area, 'id'>) => void;
  deleteConfig: (config: MqttConfig) => void;
}

// Create the context with a default undefined value
const MqttContext = createContext<MqttContextType | undefined>(undefined);

// Custom hook to use the MQTT context
export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqtt must be used within an MqttProvider');
  }
  return context;
};

interface MqttProviderProps {
  children: ReactNode;
}

const initialAreas: Area[] = [];

export const MqttProvider = ({ children }: MqttProviderProps) => {
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>(() => {
    const saved = localStorage.getItem('areas');
    if (saved) {
      try {
        const parsedAreas = JSON.parse(saved) as Area[];
        return parsedAreas.map(area => ({
          ...area,
          lastUpdated: new Date(area.lastUpdated),
        }));
      } catch (e) {
        console.error("Failed to parse areas from localStorage", e);
        return initialAreas;
      }
    }
    return initialAreas;
  });
  const [savedConfigs, setSavedConfigs] = useState<MqttConfig[]>([]);

  const [mqttConfig, setMqttConfig] = useState<MqttConfig>(() => {
    const saved = localStorage.getItem('mqtt-config');
    return saved ? JSON.parse(saved) : {
      protocol: 'wss',
      broker: 'broker.hivemq.com',
      port: 8884,
      username: '',
      password: ''
    };
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mqtt-saved-configs');
    if (saved) {
      setSavedConfigs(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('areas', JSON.stringify(areas));
  }, [areas]);

  const connect = useCallback(async () => {
    if (clientRef.current || isConnecting) return;

    setIsConnecting(true);
    const connectUrl = `${mqttConfig.protocol}://${mqttConfig.broker}:${mqttConfig.port}/mqtt`;
    console.log("Attempting to connect to:", connectUrl);

    const options: mqtt.IClientOptions = {
      clean: true,
      reconnectPeriod: 1000,
    };

    if (mqttConfig.username) {
      options.username = mqttConfig.username;
    }
    if (mqttConfig.password) {
      options.password = mqttConfig.password;
    }

    console.log("Connection options:", options);

    const client = mqtt.connect(connectUrl, options);
    clientRef.current = client;

    client.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      localStorage.setItem('mqtt-autoconnect', 'true');
      setTimeout(() => toast({ title: "MQTT Connected", description: "Successfully connected to MQTT broker." }), 0);
      
      client.subscribe('library/noise/#', (err) => {
        if (err) {
          setTimeout(() => toast({ title: "Subscription Error", description: "Failed to subscribe to noise topics.", variant: "destructive" }), 0);
        } else {
          setTimeout(() => toast({ title: "Subscribed", description: "Subscribed to all area noise topics." }), 0);
        }
      });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());

        // Store historical data
        if (data.client_id && typeof data.noise_level === 'number') {
          const newNoiseData: NoiseData = {
            deviceId: data.client_id,
            noiseLevel: data.noise_level,
            timestamp: new Date().getTime(),
          };
          
          // Retrieve, update, and clean historical data
          let history: NoiseData[] = JSON.parse(localStorage.getItem('noise-history') || '[]');
          history.push(newNoiseData);
          
          const now = new Date().getTime();
          history = history.filter(d => now - d.timestamp < MAX_HISTORY_AGE);
          
          if (history.length > MAX_HISTORY_POINTS) {
            history = history.slice(history.length - MAX_HISTORY_POINTS);
          }
          
          localStorage.setItem('noise-history', JSON.stringify(history));
        }

        if (data.alert_reason && data.client_id) {
          setAreas(prevAreas => {
            let areaExists = false;
            const updatedAreas = prevAreas.map(area => {
              if (area.deviceId === data.client_id) {
                areaExists = true;
                if (!area.isMuted) {
                  setTimeout(() => toast({
                    title: "Live Noise Alert!",
                    description: `${area.name}: ${data.alert_reason}`,
                    variant: "destructive"
                  }), 0);
                }
                return { ...area, alert: true, lastUpdated: new Date(), noise_level: data.noise_level, alert_reason: data.alert_reason };
              }
              return area;
            });

            if (!areaExists) {
              const newArea: Area = {
                id: `${prevAreas.length + 1}`,
                name: `Area ${prevAreas.length + 1}`,
                deviceId: data.client_id,
                icon: '🏢',
                lastUpdated: new Date(),
                isMuted: false,
                alert: true,
                noise_level: data.noise_level,
                alert_reason: data.alert_reason
              };
              setTimeout(() => toast({ title: "New Area Detected", description: `Added ${newArea.name} with device ${newArea.deviceId}` }), 0);
              
              setTimeout(() => {
                setAreas(prev => prev.map(area => area.deviceId === data.client_id ? { ...area, alert: false, noise_level: undefined, alert_reason: undefined } : area));
              }, 5000);

              return [...prevAreas, newArea];
            }

            setTimeout(() => {
              setAreas(prev => prev.map(area => area.deviceId === data.client_id ? { ...area, alert: false, noise_level: undefined, alert_reason: undefined } : area));
            }, 5000);

            return updatedAreas;
          });
        }
      } catch (e) {
        console.error("Failed to parse MQTT message", e);
      }
    });

    client.on('error', (error) => {
      setIsConnecting(false);
      setIsConnected(false);
      setTimeout(() => toast({ title: "Connection Error", description: `MQTT Error: ${error.message}`, variant: "destructive" }), 0);
    });

    client.on('close', () => {
      setIsConnected(false);
      setIsConnecting(false);
      setTimeout(() => toast({ title: "MQTT Disconnected", description: "Connection to MQTT broker closed." }), 0);
    });
  }, [isConnecting, mqttConfig, toast]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      localStorage.removeItem('mqtt-autoconnect');
      setTimeout(() => toast({ title: "MQTT Disconnected", description: "Manually disconnected from broker." }), 0);
    }
  }, []);

  useEffect(() => {
    const shouldAutoconnect = localStorage.getItem('mqtt-autoconnect') === 'true';
    if (shouldAutoconnect && !isConnected && !isConnecting) {
      connect();
    }
  }, [connect, isConnected, isConnecting]);

  const saveConfig = () => {
    localStorage.setItem('mqtt-config', JSON.stringify(mqttConfig));
    setSavedConfigs(prev => {
      const newConfigs = [...prev];
      const index = newConfigs.findIndex(c => c.broker === mqttConfig.broker && c.port === mqttConfig.port && c.username === mqttConfig.username);
      if (index > -1) {
        newConfigs[index] = mqttConfig;
      } else {
        newConfigs.push(mqttConfig);
      }
      localStorage.setItem('mqtt-saved-configs', JSON.stringify(newConfigs));
      return newConfigs;
    });
    setTimeout(() => toast({ title: "Configuration Saved", description: "MQTT settings saved successfully." }), 0);
  };

  const deleteConfig = (config: MqttConfig) => {
    setSavedConfigs(prev => {
      const newConfigs = prev.filter(c => c.broker !== config.broker || c.port !== config.port || c.username !== config.username);
      localStorage.setItem('mqtt-saved-configs', JSON.stringify(newConfigs));
      return newConfigs;
    });
    setTimeout(() => toast({ title: "Configuration Deleted", description: "Saved configuration has been deleted." }), 0);
  };

  const publish = (topic: string, message: string) => {
    clientRef.current?.publish(topic, message);
  };

  const addArea = (area: Omit<Area, 'id'>) => {
    setAreas(prev => {
      const newArea = { ...area, id: `${prev.length + 1}` };
      const newAreas = [...prev, newArea];
      localStorage.setItem('areas', JSON.stringify(newAreas));
      return newAreas;
    });
  };

  const value = {
    isConnected,
    isConnecting,
    areas,
    mqttConfig,
    savedConfigs,
    connect,
    disconnect,
    setMqttConfig,
    saveConfig,
    publish,
    addArea,
    deleteConfig,
  };

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
};
