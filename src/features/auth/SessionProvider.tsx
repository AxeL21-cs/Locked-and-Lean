import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { mobileApi } from "../../services/supabase";

type SessionState = {
  session: Session | null;
  loading: boolean;
  error?: string;
};
const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
});

export function AppProviders({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    mobileApi
      .getSession()
      .then((session) => {
        if (active) setState({ session, loading: false });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            session: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not restore session.",
          });
      });
    const unsubscribe = mobileApi.onAuthStateChange((session) => {
      if (active) {
        queryClient.clear();
        setState({ session, loading: false });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={state}>
        {children}
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}

export const useSession = () => useContext(SessionContext);
