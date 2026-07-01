"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface ActiveLocation {
  id: string;
  name: string;
  type: string;
  city: string;
  phone: string;
  timezone: string;
  is_active: boolean;
  has_password: boolean;
  knowledge_base: string | null;
  whatsapp_connected: boolean;
  whatsapp_display_phone: string | null;
  created_at: string;
}

interface LocationContextValue {
  activeLocation: ActiveLocation | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const loc = await apiFetch<ActiveLocation | null>("/v1/locations/active");
      setActiveLocation(loc);
    } catch {
      setActiveLocation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  async function switchLocation() {
    await apiFetch("/v1/locations/clear-active", { method: "POST" });
    setActiveLocation(null);
    router.push("/select-location");
  }

  return (
    <LocationContext.Provider value={{ activeLocation, loading, refresh, switchLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useActiveLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useActiveLocation must be used within LocationProvider");
  return ctx;
}

export function useRequireLocation() {
  const { activeLocation, loading } = useActiveLocation();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !activeLocation) {
      router.replace("/select-location");
    }
  }, [loading, activeLocation, router]);

  return { activeLocation, loading };
}
