import { Client, cacheExchange, fetchExchange, mapExchange, subscriptionExchange } from "urql";
import { createClient as createWSClient } from "graphql-ws";
import { dispatchAuthExpired } from "src/contexts/auth/AuthContext";

const wsClient =
  typeof window !== "undefined"
    ? createWSClient({
        url: () => {
          const proto = window.location.protocol === "https:" ? "wss" : "ws";
          return `${proto}://${window.location.host}/graphql`;
        },
      })
    : null;

// Same-origin urql client: queries/mutations over POST /graphql, subscriptions
// over graphql-ws. Auth rides the same-origin HTTP-only cookie (credentials:
// "include" for HTTP; the WS upgrade carries the cookie automatically), so no
// connectionParams are sent (decision E-3).
export const client = new Client({
  url: "/graphql",
  fetchOptions: { credentials: "include" },
  exchanges: [
    cacheExchange,
    mapExchange({
      onError(error) {
        const unauthenticated =
          error.graphQLErrors.some((e) => e.extensions?.code === "UNAUTHENTICATED") ||
          error.response?.status === 401;
        if (unauthenticated) {
          dispatchAuthExpired();
        }
      },
    }),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query ?? "" };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient!.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});
