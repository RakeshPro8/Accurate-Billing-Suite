import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { syncOutbox, isSyncing, subscribeSync } from "@/lib/offline-sync";
import { listOutbox } from "@/lib/offline-store";

export function ConnectivityStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  const [issues, setIssues] = useState(0);
  const [, redraw] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      setOnline(navigator.onLine);
      const items = await listOutbox();
      setPending(items.filter((item) => item.status !== "completed").length);
      setIssues(items.filter((item) => item.status === "conflict" || item.status === "error").length);
    };
    const onOnline = () => { void refresh().then(() => syncOutbox()); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", refresh);
    const unsubscribe = subscribeSync(() => { redraw((value) => value + 1); void refresh(); });
    void refresh();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", refresh);
      unsubscribe();
    };
  }, []);

  const syncing = isSyncing();
  return (
    <Badge variant="outline" className="gap-1.5 text-[11px] font-normal" title={online ? "Server connection available" : "Offline: safe cached reads and approved queued actions remain available"}>
      {online ? <Cloud className="h-3 w-3 text-emerald-400" /> : <CloudOff className="h-3 w-3 text-amber-400" />}
      {syncing ? <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing</> : online ? (issues ? `${issues} sync issue${issues === 1 ? "" : "s"}` : pending ? `${pending} pending` : "Online") : (issues ? `${issues} sync issue${issues === 1 ? "" : "s"}` : "Offline")}
    </Badge>
  );
}