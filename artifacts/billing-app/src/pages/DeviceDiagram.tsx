import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Cpu, Info, AlertCircle, CheckCircle2, Smartphone } from "lucide-react";

interface ComponentInfo {
  id: string;
  label: string;
  x: number; // 0-1, center x relative to board width
  y: number; // 0-1, center y relative to board height
  w: number; // 0-1, hotspot width relative to board width
  h: number; // 0-1, hotspot height relative to board height
  type: "ic" | "connector" | "passive" | "shield";
  function: string;
  symptoms: string[];
  whyReplace: string;
}

interface DeviceMap {
  id: string;
  label: string;
  image: string;
  width: number;
  height: number;
  components: ComponentInfo[];
}

const devices: DeviceMap[] = [
  {
    id: "android",
    label: "Android Motherboard",
    image: "/motherboard-android.jpg",
    width: 630,
    height: 1024,
    components: [
      { id: "a-cpu", label: "CPU / SoC", x: 0.50, y: 0.20, w: 0.28, h: 0.16, type: "shield", function: "The System-on-Chip runs Android, handles graphics, and controls most phone functions.", symptoms: ["Phone freezes or reboots", "Overheating", "No power or boot-loop"], whyReplace: "If the CPU is damaged by heat or liquid, the phone cannot boot. Reballing or replacing the SoC restores core functionality." },
      { id: "a-ram", label: "RAM", x: 0.70, y: 0.18, w: 0.20, h: 0.12, type: "ic", function: "Temporary memory that lets apps run and switch quickly.", symptoms: ["Apps crash or reload constantly", "System UI errors", "Random restarts"], whyReplace: "A faulty RAM chip causes app instability and boot failures. Replacing it restores smooth multitasking." },
      { id: "a-power", label: "Power IC", x: 0.25, y: 0.35, w: 0.22, h: 0.14, type: "ic", function: "Manages power from the battery and charger, distributing voltage to every chip.", symptoms: ["Phone won't turn on", "Battery drains fast", "Charging stops at a certain percentage"], whyReplace: "A bad Power IC cannot regulate voltage. Replacing it fixes charging, booting, and battery issues." },
      { id: "a-charging", label: "Charging IC", x: 0.25, y: 0.75, w: 0.22, h: 0.14, type: "ic", function: "Controls the charging port and negotiates charging speed with the adapter.", symptoms: ["Won't charge", "Slow charging", "Port gets hot"], whyReplace: "If the charging IC fails, the battery cannot recharge safely. Replacing it restores normal charging." },
      { id: "a-backlight", label: "Backlight IC", x: 0.75, y: 0.40, w: 0.20, h: 0.12, type: "ic", function: "Drives the LED backlight behind the LCD/OLED screen.", symptoms: ["Screen is black but phone rings", "Dim display", "No image after drop"], whyReplace: "A damaged Backlight IC stops the display from lighting up. Replacing it brings the screen back to life." },
      { id: "a-touch", label: "Touch IC", x: 0.75, y: 0.55, w: 0.20, h: 0.12, type: "ic", function: "Reads finger input from the digitizer and sends it to the CPU.", symptoms: ["Touch not responding", "Ghost touches", "Screen typing by itself"], whyReplace: "When the Touch IC fails, the screen becomes unusable. Replacing it restores touch response." },
      { id: "a-audio", label: "Audio IC", x: 0.22, y: 0.55, w: 0.20, h: 0.12, type: "ic", function: "Handles microphone input, earpiece, loudspeaker, and headphone signals.", symptoms: ["No sound during calls", "Microphone not working", "Speaker crackles"], whyReplace: "A faulty Audio IC cuts off sound input/output. Replacing it fixes call audio and recording." },
      { id: "a-wifi", label: "WiFi / BT IC", x: 0.75, y: 0.08, w: 0.20, h: 0.12, type: "ic", function: "Manages WiFi, Bluetooth, and sometimes GPS connectivity.", symptoms: ["WiFi grayed out", "Bluetooth won't turn on", "Weak signal"], whyReplace: "Replacing the WiFi/BT IC restores wireless connections when the chip is damaged." },
      { id: "a-batt", label: "Battery Connector", x: 0.55, y: 0.85, w: 0.24, h: 0.10, type: "connector", function: "Connects the battery to the motherboard and reports charge level.", symptoms: ["Phone reboots on movement", "No power without charger", "Incorrect battery percentage"], whyReplace: "A loose or corroded connector can cause random shutdowns. Replacing it ensures stable power." },
      { id: "a-display", label: "Display Connector", x: 0.55, y: 0.05, w: 0.24, h: 0.10, type: "connector", function: "Carries image, touch, and backlight signals between the screen and motherboard.", symptoms: ["No image", "Lines on screen", "Touch works but no display"], whyReplace: "If the connector is damaged, a good screen cannot communicate. Replacing it fixes display issues." },
      { id: "a-sim", label: "SIM Tray", x: 0.20, y: 0.92, w: 0.26, h: 0.10, type: "connector", function: "Holds the SIM card and connects it to the cellular modem.", symptoms: ["No SIM detected", "No cellular signal", "SIM tray damaged"], whyReplace: "A damaged tray or reader cannot make contact with the SIM. Replacement restores cellular service." },
      { id: "a-passive", label: "Passives", x: 0.50, y: 0.50, w: 0.30, h: 0.10, type: "passive", function: "Resistors, capacitors and inductors smooth power and filter signals all over the board.", symptoms: ["Specific function stops working", "Short circuit symptoms", "Component line fails"], whyReplace: "A burned resistor or shorted capacitor can disable a whole circuit. Replacing it restores correct voltage and current." },
    ],
  },
  {
    id: "iphone",
    label: "iPhone Logic Board",
    image: "/motherboard-iphone.png",
    width: 508,
    height: 825,
    components: [
      { id: "i-faceid", label: "Face ID", x: 0.55, y: 0.05, w: 0.26, h: 0.10, type: "shield", function: "Projects infrared dots and runs the depth-sensing system for Face ID.", symptoms: ["Face ID not available", "Move iPhone a little lower"], whyReplace: "Face ID hardware is paired and fragile. Board-level repair restores biometric authentication." },
      { id: "i-cpu", label: "A-Series CPU", x: 0.50, y: 0.22, w: 0.30, h: 0.17, type: "shield", function: "Apple's processor runs iOS, handles cameras, Face ID, and all core features.", symptoms: ["iPhone stuck on Apple logo", "Extreme overheating", "No response after liquid damage"], whyReplace: "A failed CPU cannot run iOS. Board-level repair or replacement restores the device." },
      { id: "i-wifi", label: "WiFi / BT IC", x: 0.75, y: 0.08, w: 0.20, h: 0.12, type: "ic", function: "Handles wireless networking, Bluetooth, and sometimes GPS connections.", symptoms: ["WiFi grayed out", "Bluetooth spinning", "No wireless signal"], whyReplace: "Replacing the WiFi IC restores wireless functions after chip failure." },
      { id: "i-ram", label: "RAM / Storage", x: 0.72, y: 0.25, w: 0.20, h: 0.12, type: "ic", function: "Stores running apps and system data for fast access.", symptoms: ["Apps crash constantly", "Freezes during multitasking", "Boot loop"], whyReplace: "Faulty memory causes crashes and instability. Replacement restores normal performance." },
      { id: "i-power", label: "Power Management IC", x: 0.25, y: 0.35, w: 0.22, h: 0.14, type: "ic", function: "Distributes power from the battery and charging circuit to every subsystem.", symptoms: ["Won't charge or turn on", "Boot loop", "Battery percentage jumps"], whyReplace: "The PMIC is essential for power delivery. Replacing it fixes boot and charging issues." },
      { id: "i-backlight", label: "Backlight Driver", x: 0.75, y: 0.40, w: 0.20, h: 0.12, type: "ic", function: "Powers the LCD backlight for the display.", symptoms: ["Black screen but phone vibrates", "Dim display", "No image after drop"], whyReplace: "Replacing the backlight driver restores screen illumination." },
      { id: "i-touch", label: "Touch Disease IC", x: 0.75, y: 0.55, w: 0.20, h: 0.12, type: "ic", function: "Processes touch input from the display digitizer.", symptoms: ["No touch response", "Gray flickering bar at top", "Ghost touches"], whyReplace: "This IC commonly fails due to flexion. Replacing it restores touch and fixes the gray bar." },
      { id: "i-audio", label: "Audio Codec", x: 0.22, y: 0.55, w: 0.20, h: 0.12, type: "ic", function: "Converts microphone and speaker signals for calls and media.", symptoms: ["No sound on calls", "Microphone not working", "Recording apps silent"], whyReplace: "A damaged audio codec breaks sound. Replacement restores microphone and speaker audio." },
      { id: "i-charging", label: "Tristar / Charging IC", x: 0.25, y: 0.75, w: 0.22, h: 0.14, type: "ic", function: "Communicates with the charger and controls battery charging.", symptoms: ["Won't charge", "Accessory not supported", "Slow charging"], whyReplace: "A faulty Tristar IC blocks charging. Replacing it is the standard fix for charging failures." },
      { id: "i-batt", label: "Battery Connector", x: 0.55, y: 0.85, w: 0.24, h: 0.10, type: "connector", function: "Connects the battery and reports its health to the system.", symptoms: ["Random shutdowns", "Battery not detected", "Power only when plugged in"], whyReplace: "A damaged connector breaks the battery path. Replacement ensures stable power." },
      { id: "i-display", label: "Display / Touch Connector", x: 0.55, y: 0.95, w: 0.24, h: 0.08, type: "connector", function: "Connects the screen assembly to the logic board.", symptoms: ["No display", "Touch not working", "Lines or artifacts"], whyReplace: "If the connector is damaged, the screen cannot communicate. Replacement fixes display and touch." },
      { id: "i-sim", label: "SIM Tray", x: 0.20, y: 0.92, w: 0.26, h: 0.10, type: "connector", function: "Holds the SIM card and connects it to the cellular modem.", symptoms: ["No SIM detected", "No cellular signal", "SIM tray damaged"], whyReplace: "A damaged tray or reader cannot make contact with the SIM. Replacement restores cellular service." },
    ],
  },
];

function componentColor(type: ComponentInfo["type"]) {
  switch (type) {
    case "ic": return "fill-primary/50 stroke-primary";
    case "connector": return "fill-chart-4/60 stroke-chart-4";
    case "passive": return "fill-muted/60 stroke-muted-foreground";
    case "shield": return "fill-secondary/60 stroke-secondary-foreground";
    default: return "fill-muted/60 stroke-muted-foreground";
  }
}

function ComponentIcon({ type }: { type: ComponentInfo["type"] }) {
  if (type === "connector") return <Smartphone className="h-4 w-4" />;
  if (type === "passive") return <CheckCircle2 className="h-4 w-4" />;
  return <Cpu className="h-4 w-4" />;
}

function BoardDiagram({ device, selected, onSelect }: { device: DeviceMap; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="relative inline-block w-full max-w-[420px]">
      <img
        src={device.image}
        alt={device.label}
        className="w-full h-auto rounded-lg border border-border shadow-md"
      />
      <svg
        viewBox={`0 0 ${device.width} ${device.height}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {device.components.map((c) => {
          const isSelected = selected === c.id;
          const cx = c.x * device.width;
          const cy = c.y * device.height;
          const cw = c.w * device.width;
          const ch = c.h * device.height;
          const rx = Math.min(6, cw / 4);
          return (
            <g
              key={c.id}
              className="cursor-pointer"
              onClick={() => onSelect(c.id)}
            >
              <rect
                x={cx - cw / 2}
                y={cy - ch / 2}
                width={cw}
                height={ch}
                rx={rx}
                className={`${componentColor(c.type)} transition-all hover:fill-primary/60 ${isSelected ? "stroke-[3px] fill-primary/40" : "stroke-2"}`}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-primary-foreground text-[10px] font-semibold select-none pointer-events-none drop-shadow-md"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
              >
                {c.label.length > 14 ? `${c.label.slice(0, 13)}…` : c.label}
              </text>
              {isSelected && (
                <circle cx={cx} cy={cy - ch / 2 - 8} r={6} className="fill-primary stroke-primary-foreground stroke-2" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DeviceDiagram() {
  const [activeTab, setActiveTab] = useState("android");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeDevice = devices.find((d) => d.id === activeTab) || devices[0];
  const selectedComponent = activeDevice.components.find((c) => c.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Device Diagram</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Tap a highlighted component on the real motherboard photo to learn what it does and why it may need replacement.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedId(null); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="android">Android</TabsTrigger>
          <TabsTrigger value="iphone">iPhone</TabsTrigger>
        </TabsList>

        {devices.map((device) => (
          <TabsContent key={device.id} value={device.id}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" /> {device.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <BoardDiagram device={device} selected={selectedId} onSelect={setSelectedId} />
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    {selectedComponent ? selectedComponent.label : "Select a component"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedComponent ? (
                    <p className="text-sm text-muted-foreground">
                      Click any highlighted chip or connector on the motherboard photo to see its function, common symptoms, and why it is replaced.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <ComponentIcon type={selectedComponent.type} />
                        <Badge variant="outline" className="capitalize">{selectedComponent.type}</Badge>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-1">Function</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedComponent.function}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" /> Common failure signs
                        </h3>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                          {selectedComponent.symptoms.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-secondary/40 rounded-lg p-3 border border-border">
                        <h3 className="text-sm font-semibold mb-1">Why replace it?</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedComponent.whyReplace}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
