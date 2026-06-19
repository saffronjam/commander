import type { ReactNode } from "react";
import { Provider } from "urql";

import { client } from "./client";

// GraphQLClientProvider makes the urql client available to the app. Mounted near
// the root of the provider tree (main.tsx).
export function GraphQLClientProvider({ children }: { children: ReactNode }) {
  return <Provider value={client}>{children}</Provider>;
}
