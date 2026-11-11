"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeMatch, type MatchResult } from "../matching";
import type { ID, LifestyleAnswers, Profile, Session } from "../types";
import { errorMessage, getApi, type DataApi } from "./api";

export interface Live<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Read something from the data layer and keep it fresh: the fetcher re-runs
 * whenever the store reports a change (own writes, other tabs, realtime).
 */
export function useLive<T>(fetcher: (api: DataApi) => Promise<T>, deps: unknown[] = []): Live<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: string | null }>({
    data: undefined,
    loading: true,
    error: null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    let run = 0;

    const load = async (api: DataApi) => {
      const mine = ++run;
      try {
        const data = await fetcherRef.current(api);
        if (alive && mine === run) setState({ data, loading: false, error: null });
      } catch (e) {
        if (alive && mine === run) setState((s) => ({ data: s.data, loading: false, error: errorMessage(e) }));
      }
    };

    setState((s) => ({ ...s, loading: s.data === undefined }));
    getApi()
      .then((api) => {
        if (!alive) return;
        unsubscribe = api.subscribe(() => void load(api));
        return load(api);
      })
      .catch((e) => alive && setState({ data: undefined, loading: false, error: errorMessage(e) }));

    return () => {
      alive = false;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/* ── session ───────────────────────────────────────────── */

interface Me {
  /** undefined while the first check is in flight. */
  session: Session | null | undefined;
  profile: Profile | null;
  lifestyle: LifestyleAnswers | null;
  savedIds: ID[];
  mode: "demo" | "supabase" | null;
  loading: boolean;
}

const MeContext = createContext<Me>({ session: undefined, profile: null, lifestyle: null, savedIds: [], mode: null, loading: true });

export function MeProvider({ children }: { children: ReactNode }) {
  const live = useLive(async (api) => {
    const session = await api.getSession();
    const profile = session ? await api.getMyProfile() : null;
    const lifestyle = session ? await api.getLifestyle(session.userId) : null;
    const savedIds = session ? await api.getSavedIds() : [];
    return { session, profile, lifestyle, savedIds, mode: api.mode };
  });
  const value = useMemo<Me>(
    () => ({
      session: live.data ? live.data.session : live.error ? null : undefined,
      profile: live.data?.profile ?? null,
      lifestyle: live.data?.lifestyle ?? null,
      savedIds: live.data?.savedIds ?? [],
      mode: live.data?.mode ?? null,
      loading: live.loading,
    }),
    [live.data, live.error, live.loading],
  );
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);

/** Run a write against the data layer with pending/error state. */
export function useAction<A extends unknown[], R>(fn: (api: DataApi, ...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      return await fnRef.current(api, ...args);
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending, error, clearError: () => setError(null) };
}

/** Compatibility between the signed-in person and each of the given people. */
export function useMatches(userIds: ID[]): { matches: Record<ID, MatchResult>; ready: boolean; hasMine: boolean } {
  const { lifestyle, session } = useMe();
  const key = [...new Set(userIds)].sort().join(",");
  const live = useLive((api) => api.getLifestyles(key ? key.split(",") : []), [key]);
  const matches = useMemo(() => {
    const out: Record<ID, MatchResult> = {};
    if (!lifestyle || !live.data) return out;
    for (const id of Object.keys(live.data)) {
      if (id !== session?.userId) out[id] = computeMatch(lifestyle, live.data[id]);
    }
    return out;
  }, [lifestyle, live.data, session?.userId]);
  return { matches, ready: !live.loading, hasMine: Boolean(lifestyle) };
}
