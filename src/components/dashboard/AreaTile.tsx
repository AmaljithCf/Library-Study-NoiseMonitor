import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Area } from "@/types";
import { Edit3, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AreaTileProps {
  area: Area;
  onEdit: (area: Area) => void;
  onToggleMute: (areaId: string) => void;
}

export const AreaTile = ({ area, onEdit, onToggleMute }: AreaTileProps) => {

  return (
    <Card className={cn("group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1", area.alert ? "bg-red-500 text-white" : "bg-green-500 text-white")}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{area.icon}</div>
            <div>
              <h3 className="font-semibold text-lg">{area.name}</h3>
              <p className={cn("text-sm", area.alert ? "text-white/80" : "text-white/80")}>Device: {area.deviceId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleMute(area.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {area.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(area)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {area.alert ? (
            <div className="flex items-center justify-center text-white flex-col gap-2">
              <AlertTriangle className="h-8 w-8" />
              <span className="text-lg font-semibold">{area.alert_reason}</span>
              <span className="text-2xl font-bold">{area.noise_level} dB</span>
            </div>
          ) : (
            <div className="flex items-center justify-center text-white flex-col gap-2">
              <span className="text-lg font-semibold">All Quiet</span>
              <span className="text-xs">No noise alerts at the moment.</span>
            </div>
          )}

          <div className={cn("text-xs", area.alert ? "text-white/80" : "text-white/80")}>
            Last updated: {area.lastUpdated.toLocaleTimeString()}
          </div>

          {area.isMuted && (
            <Badge variant="secondary" className="w-full justify-center">
              Notifications Muted
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};