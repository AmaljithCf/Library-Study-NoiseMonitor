
import { useMqtt } from "@/context/MqttContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, Save, Play, Square, Trash2 } from "lucide-react";
import { MqttConfig } from "@/types";
import { Separator } from "@/components/ui/separator";

interface MqttSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MqttSetupModal = ({ isOpen, onClose }: MqttSetupModalProps) => {
  const {
    isConnected,
    isConnecting,
    mqttConfig,
    savedConfigs,
    setMqttConfig,
    connect,
    disconnect,
    saveConfig,
    deleteConfig
  } = useMqtt();

  const handleConnectToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className={`h-5 w-5 ${isConnected ? 'text-green-500' : 'text-primary'}`} />
            MQTT Broker Setup
            {isConnected && <Badge variant="secondary" className="text-green-600">Connected</Badge>}
          </DialogTitle>
          <DialogDescription>
            Configure your MQTT broker settings to connect to the service.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 px-2">
          {savedConfigs.length > 0 && (
            <div className="space-y-2">
              <Label>Saved Connections</Label>
              <div className="space-y-2">
                {savedConfigs.map((config, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                    <button onClick={() => setMqttConfig(config)} className="text-left flex-grow">
                      <p className="font-semibold">{config.username}@{config.broker}</p>
                      <p className="text-sm text-muted-foreground">{config.protocol} - Port: {config.port}</p>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => deleteConfig(config)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="protocol" className="text-right">Protocol</Label>
            <Select
              value={mqttConfig.protocol}
              onValueChange={(value: 'ws' | 'wss') => setMqttConfig({ ...mqttConfig, protocol: value })}
              disabled={isConnected || isConnecting}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ws">ws</SelectItem>
                <SelectItem value="wss">wss</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="broker" className="text-right">Broker URL</Label>
            <Input
              id="broker"
              placeholder="broker.hivemq.com"
              value={mqttConfig.broker}
              onChange={(e) => setMqttConfig({ ...mqttConfig, broker: e.target.value })}
              className="col-span-3"
              disabled={isConnected || isConnecting}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="port" className="text-right">Port</Label>
            <Input
              id="port"
              type="number"
              placeholder="8884"
              value={mqttConfig.port}
              onChange={(e) => setMqttConfig({ ...mqttConfig, port: parseInt(e.target.value) })}
              className="col-span-3"
              disabled={isConnected || isConnecting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="your-username"
              value={mqttConfig.username}
              onChange={(e) => setMqttConfig({ ...mqttConfig, username: e.target.value })}
              disabled={isConnected || isConnecting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={mqttConfig.password || ''}
              onChange={(e) => setMqttConfig({ ...mqttConfig, password: e.target.value })}
              disabled={isConnected || isConnecting}
            />
          </div>
        </div>
        
        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button 
            onClick={handleConnectToggle}
            disabled={isConnecting || !mqttConfig.broker}
            variant={isConnected ? "destructive" : "default"}
          >
            {isConnecting ? (
              <><Wifi className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
            ) : isConnected ? (
              <><Square className="h-4 w-4 mr-2" />Disconnect</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Connect</>
            )}
          </Button>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={saveConfig} disabled={isConnecting || isConnected}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
