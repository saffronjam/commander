import { Request, RequestHandler, Response } from "express";
import { Service } from "./service";
import { ApiError } from "common/src/apiTypes";

export type RouteContext = {};

export type Route = {
  method: "get" | "post" | "put" | "delete";
  path: string;
  handler: RequestHandler;
};

const dataHandler = async (res: Response, getData: () => Promise<any>) => {
  return await getData()
    .then((data) => {
      return res.json(data);
    })
    .catch((err) => {
      if (err instanceof ApiError) {
        return res.status(err.code).json(err);
      }

      return res.status(500).json({ error: err.message, code: 500 });
    });
};

export const makeRoutes = (
  service: Service,
  context: RouteContext
): Route[] => {
  return [
    {
      method: "get",
      path: "/",
      handler: (req: Request, res: Response) => {
        res.json({ message: "Ouch! Look like you hit the API" });
      },
    },
    {
      method: "get",
      path: "/api/satisfactoryApiCheck",
      handler: async (req: Request, res: Response) => {
        return res.json({ up: service.isSatisfactoryApiAvailable() });
      },
    },
    {
      method: "get",
      path: "/api/circuits",
      handler: async (req: Request, res: Response) => {
        return dataHandler(res, service.getCircuits.bind(service));
      },
    },
    {
      method: "get",
      path: "/api/factoryStats",
      handler: async (req: Request, res: Response) => {
        return await dataHandler(res, service.getFactoryStats.bind(service));
      },
    },
    {
      method: "get",
      path: "/api/prodStats",
      handler: async (req: Request, res: Response) => {
        return dataHandler(res, service.getProdStats.bind(service));
      },
    },
    {
      method: "get",
      path: "/api/sinkStats",
      handler: async (req: Request, res: Response) => {
        return dataHandler(res, service.getSinkStats.bind(service));
      },
    },
    {
      method: "get",
      path: "/api/itemStats",
      handler: async (req: Request, res: Response) => {
        return dataHandler(res, service.getItemStats.bind(service));
      },
    },
    {
      method: "get",
      path: "/api/players",
      handler: async (req: Request, res: Response) => {
        return dataHandler(res, service.getPlayers.bind(service));
      },
    },
    {
      method: "get",
      path: "/api/generatorStats",
      handler: async (req: Request, res: Response) => {
        return dataHandler(res, service.getGeneratorStats.bind(service));
      },
    },
  ];
};
