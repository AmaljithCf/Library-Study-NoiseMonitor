import { Button } from "@/components/ui/button";
import { Plus, Settings, BarChart3, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  onAddArea: () => void;
  onShowAnalytics: () => void;
  onSetupMqtt: () => void;
  totalAreas: number;
  activeAlerts: number;
}

export const Header = ({ onAddArea, onShowAnalytics, onSetupMqtt, totalAreas, activeAlerts }: HeaderProps) => {
  const { toast } = useToast();

  return (
    <header className="bg-gradient-hero shadow-elegant border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <BarChart3 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary-foreground">
                Library Noise Monitor
              </h1>
              <p className="text-primary-foreground/80 mt-1">
                Managing {totalAreas} areas • {activeAlerts} active alerts
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="secondary" 
              onClick={onSetupMqtt}
              className="bg-white/20 hover:bg-white/30 text-primary-foreground border-white/30"
            >
              <Wifi className="h-4 w-4 mr-2" />
              MQTT Setup
            </Button>

            <Button 
              variant="secondary" 
              onClick={onShowAnalytics}
              className="bg-white/20 hover:bg-white/30 text-primary-foreground border-white/30"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            
            <Button 
              onClick={onAddArea}
              className="bg-white hover:bg-white/90 text-primary shadow-glow"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Area
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};