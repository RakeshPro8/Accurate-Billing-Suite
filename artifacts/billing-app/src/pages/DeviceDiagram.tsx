import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Cpu, Info, AlertCircle, CheckCircle2, Smartphone } from "lucide-react";

interface ComponentInfo {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "ic" | "connector" | "passive" | "shield";
  function: string;
  symptoms: string[];
  whyReplace: string;
}

interface DeviceMap {
  id: string;
  label: string;
  width: number;
  height: number;
  outline: string;
  components: ComponentInfo[];
}

const devices: DeviceMap[] = [
  {
    id: "android",
    label: "Android Motherboard",
    width: 420,
    height: 700,
    outline: "M 40,20 L 380,20 C 400,20 400,40 400,60 L 400,640 C 400,660 400,680 380,680 L 40,680 C 20,680 20,660 20,640 L 20,60 C 20,40 20,20 40,20 Z",
    components: [
      { id: "a-cpu", label: "CPU / SoC", x: 210, y: 180, type: "ic", function: "The System-on-Chip runs the operating system, handles graphics, and controls most phone functions.", symptoms: ["Phone freezes or reboots", "Overheating", "No power or boot-loop"], whyReplace: "If the CPU is damaged by heat or liquid, the phone cannot boot. Reballing or replacing the SoC restores core functionality." },
      { id: "a-ram", label: "RAM", x: 290, y: 170, type: "ic", function: "Temporary memory that lets apps run and switch quickly.", symptoms: ["Apps crash or reload constantly", "System UI errors", "Random restarts"], whyReplace: "A faulty RAM chip causes app instability and boot failures. Replacing it restores smooth multitasking." },
      { id: "a-power", label: "Power IC", x: 120, y: 280, type: "ic", function: "Manages power from the battery and charger, distributing voltage to every chip.", symptoms: ["Phone won't turn on", "Battery drains fast", "Charging stops at a certain percentage"], whyReplace: "A bad Power IC cannot regulate voltage. Replacing it fixes charging, booting, and battery issues." },
      { id: "a-charging", label: "Charging IC", x: 120, y: 560, type: "ic", function: "Controls the charging port and negotiates charging speed with the adapter.", symptoms: ["Won't charge", "Slow charging", "Port gets hot"], whyReplace: "If the charging IC fails, the battery cannot recharge safely. Replacing it restores normal charging." },
      { id: "a-backlight", label: "Backlight IC", x: 310, y: 340, type: "ic", function: "Drives the LED backlight behind the LCD/OLED screen.", symptoms: ["Screen is black but phone rings", "Dim display", "No image after drop"], whyReplace: "A damaged Backlight IC stops the display from lighting up. Replacing it brings the screen back to life." },
      { id: "a-touch", label: "Touch IC", x: 310, y: 420, type: "ic", function: "Reads finger input from the digitizer and sends it to the CPU.", symptoms: ["Touch not responding", "Ghost touches", "Screen typing by itself"], whyReplace: "When the Touch IC fails, the screen becomes unusable. Replacing it restores touch response." },
      { id: "a-audio", label: "Audio IC", x: 80, y: 400, type: "ic", function: "Handles microphone input, earpiece, loudspeaker, and headphone signals.", symptoms: ["No sound during calls", "Microphone not working", "Speaker crackles"], whyReplace: "A faulty Audio IC cuts off sound input/output. Replacing it fixes call audio and recording." },
      { id: "a-wifi", label: "WiFi / BT IC", x: 300, y: 90, type: "ic", function: "Manages WiFi, Bluetooth, and sometimes GPS connectivity.", symptoms: ["WiFi grayed out", "Bluetooth won't turn on", "Weak signal"], whyReplace: "Replacing the WiFi/BT IC restores wireless connections when the chip is damaged." },
      { id: "a-batt", label: "Battery Connector", x: 210, y: 620, type: "connector", function: "Connects the battery to the motherboard and reports charge level.", symptoms: ["Phone reboots on movement", "No power without charger", "Incorrect battery percentage"], whyReplace: "A loose or corroded connector can cause random shutdowns. Replacing it ensures stable power." },
      { id: "a-display", label: "Display Connector", x: 210, y: 50, type: "connector", function: "Carries image, touch, and backlight signals between the screen and motherboard.", symptoms: ["No image", "Lines on screen", "Touch works but no display"], whyReplace: "If the connector is damaged, a good screen cannot communicate. Replacing it fixes display issues." },
      { id: "a-resistor", label: "Resistor", x: 180, y: 340, type: "passive", function: "Limits current and divides voltage in power and signal lines.", symptoms: ["Specific function stops working", "Short circuit symptoms", "Component line fails"], whyReplace: "A burned resistor can open or short a circuit. Replacing it restores correct voltage and current." },
      { id: "a-capacitor", label: "Capacitor", x: 250, y: 340, type: "passive", function: "Stores and releases energy to smooth out power spikes.", symptoms: ["Instability under load", "Random reboots", "Power line short"], whyReplace: "A failed capacitor can cause voltage ripples. Replacing it stabilizes the power supply." },
    ],
  },
  {
    id: "iphone",
    label: "iPhone Logic Board",
    width: 360,
    height: 720,
    outline: "M 30,10 L 330,10 C 345,10 350,25 350,40 L 350,680 C 350,695 345,710 330,710 L 30,710 C 15,710 10,695 10,680 L 10,40 C 10,25 15,10 30,10 Z",
    components: [
      { id: "i-cpu", label: "A-Series CPU", x: 180, y: 160, type: "shield", function: "Apple's processor runs iOS, handles Face ID, cameras, and all core features.", symptoms: ["iPhone stuck on Apple logo", "Extreme overheating", "No response after liquid damage"], whyReplace: "A failed CPU cannot run iOS. Board-level repair or replacement restores the device." },
      { id: "i-power", label: "Power Management IC", x: 80, y: 280, type: "ic", function: "Distributes power from the battery and charging circuit to every subsystem.", symptoms: ["Won't charge or turn on", "Boot loop", "Battery percentage jumps"], whyReplace: "The PMIC is essential for power delivery. Replacing it fixes boot and charging issues." },
      { id: "i-charging", label: "Tristar / Charging IC", x: 80, y: 520, type: "ic", function: "Communicates with the charger and controls battery charging.", symptoms: ["Won't charge", "Accessory not supported", "Slow charging"], whyReplace: "A faulty Tristar IC blocks charging. Replacing it is the standard fix for charging failures." },
      { id: "i-backlight", label: "Backlight Driver", x: 280, y: 320, type: "ic", function: "Powers the LCD backlight for the display.", symptoms: ["Black screen but phone vibrates", "Dim display", "No image after drop"], whyReplace: "Replacing the backlight driver restores screen illumination." },
      { id: "i-touch", label: "Touch Disease IC", x: 280, y: 420, type: "ic", function: "Processes touch input from the display digitizer.", symptoms: ["No touch response", "Gray flickering bar at top", "Ghost touches"], whyReplace: "This IC commonly fails due to flexion. Replacing it restores touch and fixes the gray bar." },
      { id: "i-audio", label: "Audio Codec", x: 60, y: 400, type: "ic", function: "Converts microphone and speaker signals for calls and media.", symptoms: ["No sound on calls", "Microphone not working", "Recording apps silent"], whyReplace: "A damaged audio codec breaks sound. Replacement restores microphone and speaker audio." },
      { id: "i-faceid", label: "Face ID / Dot Projector", x: 180, y: 60, type: "shield", function: "Projects infrared dots for Face ID and depth sensing.", symptoms: ["Face ID not available", "Move iPhone a little lower"], whyReplace: "Face ID hardware is paired and fragile. Repair restores biometric authentication." },
      { id: "i-wifi", label: "WiFi / Bluetooth IC", x: 280, y: 90, type: "ic", function: "Handles wireless networking and Bluetooth connections.", symptoms: ["WiFi grayed out", "Bluetooth spinning", "No wireless signal"], whyReplace: "Replacing the WiFi IC restores wireless functions after chip failure." },
      { id: "i-batt", label: "Battery Connector", x: 180, y: 640, type: "connector", function: "Connects the battery and reports its health to the system.", symptoms: ["Random shutdowns", "Battery not detected", "Power only when plugged in"], whyReplace: "A damaged connector breaks the battery path. Replacement ensures stable power." },
      { id: "i-display", label: "Display / Touch Connector", x: 180, y: 30, type: "connector", function: "Connects the screen assembly to the logic board.", symptoms: ["No display", "Touch not working", "Lines or artifacts"], whyReplace: "If the connector is damaged, the screen cannot communicate. Replacement fixes display and touch." },
      { id: "i- inductor", label: "Inductor", x: 140, y: 340, type: "passive", function: "Stores magnetic energy in power supply circuits.", symptoms: ["Power supply noise", "Heating in one area", "Component not getting voltage"], whyReplace: "A failed inductor disrupts power regulation. Replacement restores proper voltage to the circuit." },
      { id: "i-diode", label: "Diode", x: 220, y: 340, type: "passive", function: "Allows current to flow in one direction and protects circuits.", symptoms: ["Short circuit", "Component not powering", "Battery draining fast"], whyReplace: "A shorted diode can leak power or block it. Replacement restores correct circuit polarity." },
    ],
  },
];

function componentColor(type: ComponentInfo["type"]) {
  switch (type) {
    case "ic": return "fill-primary/40 stroke-primary";
    case "connector": return "fill-chart-4/50 stroke-chart-4";
    case "passive": return "fill-muted/50 stroke-muted-foreground";
    case "shield": return "fill-secondary/50 stroke-secondary-foreground";
    default: return "fill-muted/50 stroke-muted-foreground";
  }
}

function ComponentIcon({ type }: { type: ComponentInfo["type"] }) {
  if (type === "connector") return <Smartphone className="h-4 w-4" />;
  if (type === "passive") return <CheckCircle2 className="h-4 w-4" />;
  return <Cpu className="h-4 w-4" />;
}

function BoardDiagram({ device, selected, onSelect }: { device: DeviceMap; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="relative inline-block">
      <svg viewBox={`0 0 ${device.width} ${device.height}`} className="w-full max-w-[420px] h-auto drop-shadow-lg">
        <path d={device.outline} className="fill-card stroke-border stroke-2" />
        {/* Decorative board traces */}
        <path d="M 40,80 L 200,80 M 40,120 L 320,120 M 40,500 L 320,500 M 40,600 L 200,600" className="stroke-muted-foreground/10" strokeWidth="1" fill="none" />
        <path d="M 80,250 L 80,450 M 280,250 L 280,550" className="stroke-muted-foreground/10" strokeWidth="1" fill="none" />
        <circle cx="180" cy="360" r="80" className="fill-muted/10 stroke-muted-foreground/10" strokeWidth="1" strokeDasharray="4 4" />

        {device.components.map((c) => {
          const isSelected = selected === c.id;
          return (
            <g
              key={c.id}
              className="cursor-pointer"
              onClick={() => onSelect(c.id)}
              transform={`translate(${c.x - 34}, ${c.y - 18})`}
            >
              <rect
                width="68"
                height="36"
                rx="6"
                className={`${componentColor(c.type)} transition-all ${isSelected ? "stroke-[3px]" : "stroke-2"} ${isSelected ? "fill-primary/30" : ""}`}
              />
              <text
                x="34"
                y="21"
                textAnchor="middle"
                className="fill-[hsl(var(--card-foreground))] text-[10px] font-semibold select-none pointer-events-none"
              >
                {c.label.length > 12 ? `${c.label.slice(0, 11)}…` : c.label}
              </text>
              {isSelected && (
                <circle cx="34" cy="-8" r="5" className="fill-primary stroke-primary-foreground" />
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
          Tap a motherboard component to explain what it does and why it may need replacement.
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
                      Click any highlighted chip or connector on the board to see its function, common symptoms, and why it is replaced.
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
