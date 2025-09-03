import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Area } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface AddAreaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (area: Omit<Area, 'id' | 'lastUpdated' | 'isMuted' | 'alert' | 'noise_level' | 'alert_reason'>) => void;
  editingArea?: Area;
}

const defaultIcons = ['📚', '🤫', '💻', '👥', '📖', '🎯', '🔬', '📰'];

export const AddAreaModal = ({ open, onOpenChange, onSave, editingArea }: AddAreaModalProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: editingArea?.name || '',
    deviceId: editingArea?.deviceId || '',
    icon: editingArea?.icon || '📚',
  });

  const handleSave = () => {
    if (!formData.name.trim() || !formData.deviceId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
    onOpenChange(false);
    
    // Reset form
    setFormData({
      name: '',
      deviceId: '',
      icon: '📚',
    });

    toast({
      title: editingArea ? "Area Updated" : "Area Created",
      description: `${formData.name} has been ${editingArea ? 'updated' : 'added'} successfully`
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingArea ? 'Edit Area' : 'Add New Area'}
          </DialogTitle>
          <DialogDescription>
            {editingArea ? 'Update the details of your existing area.' : 'Fill in the details to add a new area to monitor.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Area Name</Label>
            <Input
              id="name"
              placeholder="e.g., Reading Hall"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deviceId">Device ID</Label>
            <Input
              id="deviceId"
              placeholder="e.g., device-101"
              value={formData.deviceId}
              onChange={(e) => setFormData(prev => ({ ...prev, deviceId: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-4 gap-2">
              {defaultIcons.map((icon) => (
                <Button
                  key={icon}
                  variant={formData.icon === icon ? "default" : "outline"}
                  className="text-xl h-12"
                  onClick={() => setFormData(prev => ({ ...prev, icon }))}
                >
                  {icon}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {editingArea ? 'Update' : 'Add'} Area
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
