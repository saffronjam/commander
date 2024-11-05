import { Request, RequestHandler, Response } from "express";
import { Service } from "./service";
import { ApiError, FullState, SseEvent } from "common/src/apiTypes";
import { RedisClientType } from "@redis/client";
import { Client, SatisfactoryEvent } from "./types";

export type RouteContext = {
  redis: RedisClientType;
};

export type Route = {
  method: "get" | "post" | "put" | "delete";
  path: string;
  handler: RequestHandler;
};

let clients: Map<number, Client> = new Map();

const createNewClient = () => {
  const client = {
    id: Date.now(),
  } as Client;

  clients.set(client.id, client);

  console.log(`Adding new client ${client.id} [currently ${clients.size}]`);

  return client;
};

const removeClient = (client: Client) => {
  clients.delete(client.id);
  console.log(`Removing client ${client.id} [currently ${clients.size}]`);
};

export const makeRoutes = (
  service: Service,
  context: RouteContext
): Route[] => {
  return [
    {
      method: "get",
      path: "/api/events",
      handler: (request: any, response: any) => {
        const headers = {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
        };
        response.writeHead(200, headers);

        const client = createNewClient();

        const redisListener = (message: string, _channel: string) => {
          const parsed = JSON.parse(message) as SatisfactoryEvent<any>;
          pushSseEvent({
            type: parsed.type,
            clientId: client.id,
            data: parsed.data,
          });
        };

        clients.set(client.id, client);
        request.on("close", () => {
          removeClient(client);
          context.redis.removeListener("satisfactory-event", redisListener);
        });

        const pushSseEvent = <T>(event: SseEvent<T>) => {
          response.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        // Setup Redis pub/sub
        context.redis.subscribe("satisfactory-event", redisListener);
      },
    },
    {
      method: "get",
      path: "/api/state",
      handler: async (_req: Request, res: Response) => {
        const state = await service.getFullState();
        res.json(state);
      },
    },
    {
      method: "get",
      path: "/",
      handler: (_req: Request, res: Response) => {
        res.json({ message: "Ouch! Look like you hit the API" });
      },
    },
  ];
};
