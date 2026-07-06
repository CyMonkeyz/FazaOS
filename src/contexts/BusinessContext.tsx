import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type Business = {
  id: string;
  name: string;
  description: string | null;
};

type Ctx = {
  businesses: Business[];
  isLoading: boolean;
  selectedBusinessId: string | null;
  selectedBusiness: Business | null;
  isAllBusinesses: boolean;
  setSelectedBusinessId: (id: string | null) => void;
  requireSelectedBusiness: () => string | null;
};

const BusinessContext = createContext<Ctx | null>(null);
const LS_KEY = "faza-selected-business-id";

export function BusinessProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_KEY);
  });

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: queryKeys.business.list,
    queryFn: async (): Promise<Business[]> => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id,name,description")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Business[];
    },
    refetchInterval: 60_000,
  });

  // Sync pref → local (once, when nothing local yet)
  useQuery({
    queryKey: ["user-selected-business"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await supabase
        .from("user_preferences")
        .select("selected_business_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const id = (p as { selected_business_id?: string } | null)?.selected_business_id ?? null;
      if (id && !localStorage.getItem(LS_KEY)) {
        localStorage.setItem(LS_KEY, id);
        setSelectedId(id);
      }
      return id;
    },
    staleTime: 5 * 60_000,
  });

  // Auto-pick default/first business if nothing selected
  useEffect(() => {
    if (!businesses.length) return;
    if (selectedId && businesses.some((b) => b.id === selectedId)) return;
    // keep "all" (null) as valid choice — only auto-pick when localStorage empty
    if (!localStorage.getItem(LS_KEY) && selectedId === null) {
      const def = businesses[0];
      setSelectedId(def.id);
      localStorage.setItem(LS_KEY, def.id);
    }
  }, [businesses, selectedId]);

  const setSelectedBusinessId = (id: string | null) => {
    setSelectedId(id);
    if (id) localStorage.setItem(LS_KEY, id);
    else localStorage.removeItem(LS_KEY);
    // persist in preferences (fire-and-forget)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("user_preferences")
        .upsert({ user_id: data.user.id, selected_business_id: id } as never, {
          onConflict: "user_id",
        })
        .then(
          () => {},
          () => {},
        );
    });
    // invalidate business-scoped queries
    qc.invalidateQueries({ queryKey: ["business-overview"] });
    qc.invalidateQueries({ queryKey: ["business-products"] });
    qc.invalidateQueries({ queryKey: ["business-sales"] });
    qc.invalidateQueries({ queryKey: ["business-suppliers"] });
  };

  const value = useMemo<Ctx>(() => {
    const selectedBusiness = businesses.find((b) => b.id === selectedId) ?? null;
    return {
      businesses,
      isLoading,
      selectedBusinessId: selectedId,
      selectedBusiness,
      isAllBusinesses: selectedId === null,
      setSelectedBusinessId,
      requireSelectedBusiness: () => selectedId,
    };
  }, [businesses, isLoading, selectedId]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
