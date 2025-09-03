
import { useState } from "react";
import { useMqtt } from "@/context/MqttContext";
import { Header } from "./Header";
import { AreaTile } from "./AreaTile";
import { AddAreaModal } from "./AddAreaModal";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { MqttSetupModal } from "./MqttSetupModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Area } from "@/types";

export const Dashboard = () => {
  const { areas, addArea } = useMqtt();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showMqttSetup, setShowMqttSetup] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | undefined>();

  // The MqttProvider now handles area state and updates.
  // The simulation logic is also there for when not connected.

  const handleAddArea = (areaData: Omit<Area, 'id' | 'lastUpdated' | 'isMuted' | 'alert' | 'noise_level' | 'alert_reason'>) => {
    addArea({
      ...areaData,
      lastUpdated: new Date(),
      isMuted: false,
      alert: false,
    });
    setShowAddModal(false);
  };

  const handleEditArea = (areaData: Omit<Area, 'id' | 'currentNoise' | 'status' | 'lastUpdated'>) => {
    console.log("Editing area (not fully implemented in this refactor):", areaData);
    setEditingArea(undefined);
  };

  const handleToggleMute = (areaId: string) => {
    // The mute logic is now managed within the MqttProvider's area state
    // To toggle mute, we would need to update the state in the provider
    console.log("Toggling mute (not fully implemented in this refactor):", areaId);
  };

  const activeAlerts = areas.filter(area => area.status === 'loud' && !area.isMuted).length;

  if (showAnalytics) {
    return <AnalyticsPanel areas={areas} onBack={() => setShowAnalytics(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onAddArea={() => setShowAddModal(true)}
        onShowAnalytics={() => setShowAnalytics(true)}
        onSetupMqtt={() => setShowMqttSetup(true)}
        totalAreas={areas.length}
        activeAlerts={activeAlerts}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {areas.map((area) => (
            <AreaTile
              key={area.id}
              area={area}
              onEdit={setEditingArea}
              onToggleMute={handleToggleMute}
            />
          ))}
          
          <div className="flex items-center justify-center min-h-[280px]">
            <Button
              variant="outline"
              className="h-32 w-full border-dashed border-2 hover:bg-muted/50 flex-col space-y-2"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-8 w-8 text-muted-foreground" />
              <span className="text-muted-foreground">Add New Area</span>
            </Button>
          </div>
        </div>
      </main>

      <AddAreaModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSave={handleAddArea}
      />

      <AddAreaModal
        open={!!editingArea}
        onOpenChange={(open) => !open && setEditingArea(undefined)}
        onSave={handleEditArea}
        editingArea={editingArea}
      />

      <MqttSetupModal
        isOpen={showMqttSetup}
        onClose={() => setShowMqttSetup(false)}
      />
    </div>
  );
};
