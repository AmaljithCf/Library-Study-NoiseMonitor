import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Download, TrendingUp, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { Area, NoiseData } from "@/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useEffect, useState } from "react";

interface AnalyticsData {
  hourlyTrends: { time: string; [key: string]: number | string }[];
  areaAverages: { name: string; average: number }[];
  areaAlerts: { name: string; alerts: number }[];
}

type TimeRange = "1h" | "12h" | "24h" | "3d" | "7d";

const timeRangeConfig = {
  "1h": { hours: 1, label: "1-Hour" },
  "12h": { hours: 12, label: "12-Hour" },
  "24h": { hours: 24, label: "24-Hour" },
  "3d": { hours: 72, label: "3-Day" },
  "7d": { hours: 168, label: "1-Week" },
};

interface AnalyticsPanelProps {
  areas: Area[];
  onBack: () => void;
}

export const AnalyticsPanel = ({ areas, onBack }: AnalyticsPanelProps) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  const lineColors = [
    "hsl(var(--primary))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);

        setLoading(true);
        const { hours } = timeRangeConfig[timeRange];
        const now = new Date().getTime();
        const startTime = now - hours * 60 * 60 * 1000;

        const history: NoiseData[] = JSON.parse(localStorage.getItem('noise-history') || '[]');
        const filteredHistory = history.filter(d => d.timestamp >= startTime);

        const hourlyTrends: { time: string; [key: string]: number | string }[] = [];
        const timeSlots = new Map<string, { [key: string]: number[] }>();

        for (const dataPoint of filteredHistory) {
          const date = new Date(dataPoint.timestamp);
          const timeKey = date.toLocaleString([], {
            month: hours > 24 ? 'short' : undefined,
            day: hours > 24 ? 'numeric' : undefined,
            hour: '2-digit',
            minute: '2-digit'
          });

          if (!timeSlots.has(timeKey)) {
            timeSlots.set(timeKey, {});
          }

          const area = areas.find(a => a.deviceId === dataPoint.deviceId);
          if (area) {
            if (!timeSlots.get(timeKey)![area.name]) {
              timeSlots.get(timeKey)![area.name] = [];
            }
            timeSlots.get(timeKey)![area.name].push(dataPoint.noiseLevel);
          }
        }

        timeSlots.forEach((areaData, time) => {
          const hourData: { time: string; [key: string]: number | string } = { time };
          areas.forEach(area => {
            const values = areaData[area.name];
            if (values && values.length > 0) {
              hourData[area.name] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
            } else {
              hourData[area.name] = 0;
            }
          });
          hourlyTrends.push(hourData);
        });

        const areaAverages = areas.map(area => {
          const areaData = filteredHistory.filter(d => d.deviceId === area.deviceId);
          const average = areaData.length > 0
            ? Math.round(areaData.reduce((sum, d) => sum + d.noiseLevel, 0) / areaData.length)
            : 0;
          return { name: area.name, average };
        });

        const areaAlerts = areas.map(area => {
          const alerts = filteredHistory.filter(d => d.deviceId === area.deviceId && d.noiseLevel > 70).length; // Example: alert threshold at 70dB
          return { name: area.name, alerts };
        });

        setAnalyticsData({ hourlyTrends, areaAverages, areaAlerts });
        setError(null);
      } catch (err) {
        setError("Failed to fetch analytics data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (areas.length > 0) {
      fetchAnalytics();
    }
  }, [areas, timeRange]);

  const mostAlertsArea = analyticsData?.areaAlerts?.reduce(
    (max, area) => (area.alerts > max.alerts ? area : max),
    { name: "N/A", alerts: 0 }
  );

  const totalAlerts = areas.filter(area => area.alert).length;
  const averageNoise = Math.round(areas.reduce((sum, area) => sum + (area.noise_level || 0), 0) / areas.length) || 0;
  const quietestArea = areas.length > 0
    ? areas.reduce((quietest, area) =>
      (area.noise_level || 100) < (quietest.noise_level || 100) ? area : quietest
    )
    : null;
  const handleExport = () => {
    const csvData = areas.map(area => 
      `${area.name},${area.deviceId},${area.noise_level || 'N/A'},${area.alert},${new Date(area.lastUpdated).toLocaleString()}`
    ).join('\n');
    
    const header = 'Area Name,Device ID,Noise Level (dB),Is Alerting,Last Updated\n';
    const blob = new Blob([header + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'noise-analytics.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-hero shadow-elegant border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={onBack}
                className="text-primary-foreground hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-primary-foreground">
                  Analytics & Reports
                </h1>
                <p className="text-primary-foreground/80 mt-1">
                  24-hour noise monitoring insights
                </p>
              </div>
            </div>

            <Button 
              onClick={handleExport}
              className="bg-white hover:bg-white/90 text-primary"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                  <p className="text-3xl font-bold text-destructive">{totalAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Noise</p>
                  <p className="text-3xl font-bold">{averageNoise} dB</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Quietest Area</p>
                  <p className="text-xl font-bold">{quietestArea?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{quietestArea?.noise_level || 0} dB</p>
                </div>
                <div className="text-2xl">{quietestArea?.icon}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monitored Areas</p>
                  <p className="text-3xl font-bold">{areas.length}</p>
                </div>
                <Clock className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Most Alerts ({timeRangeConfig[timeRange].label})</p>
                  <p className="text-xl font-bold">{mostAlertsArea?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{mostAlertsArea?.alerts || 0} alerts</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="space-y-8">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-lg">Loading historical data...</p>
            </div>
          ) : error ? (
            <Card className="border-destructive">
              <CardContent className="p-6 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive mr-4" />
                <p className="text-lg text-destructive-foreground">{error}</p>
              </CardContent>
            </Card>
          ) : analyticsData ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{timeRangeConfig[timeRange].label} Noise Trends</CardTitle>
                  <ToggleGroup
                    type="single"
                    defaultValue="24h"
                    value={timeRange}
                    onValueChange={(value: TimeRange) => value && setTimeRange(value)}
                    aria-label="Select time range"
                  >
                    <ToggleGroupItem value="1h">1H</ToggleGroupItem>
                    <ToggleGroupItem value="12h">12H</ToggleGroupItem>
                    <ToggleGroupItem value="24h">24H</ToggleGroupItem>
                    <ToggleGroupItem value="3d">3D</ToggleGroupItem>
                    <ToggleGroupItem value="7d">7D</ToggleGroupItem>
                  </ToggleGroup>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.hourlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis domain={[40, 80]} />
                        <Tooltip />
                        {areas.map((area, index) => (
                          <Line
                            key={area.id}
                            type="monotone"
                            dataKey={area.name}
                            stroke={lineColors[index % lineColors.length]}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Noise Levels (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.areaAverages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="average" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};
