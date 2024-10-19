import { config } from "dotenv";
import path from "path";
import { access } from 'fs/promises';

import express from "express";

import morgan from "morgan";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";

import { makeRoutes, RouteContext } from "./routes";
import { env } from "process";
import { Service as IService } from "./service";

const loadEnvFile = async () => {
  const envFile =
    process.env.NODE_ENV === "development" ? ".env.development" : ".env";
  const envPath = path.resolve(process.cwd(), envFile);

  try {
    await access(envPath);
    console.log(`Loading environment variables from ${envFile}`);
    config({ path: envPath });
  } catch (err) {
    console.warn(`Could not find ${envFile}, falling back to default .env`);
    config();
  }
};

export const createServer = async () => {
  console.log("Creating server");

  await loadEnvFile();

  console.log(process.env.USE_MOCK);

  const genService = async (): Promise<IService> => {
    if (env.USE_MOCK) {
      const green = "\x1b[32m";
      console.log("Using %smock\x1b[0m server", green);
      const { MockService } = await import("./mock/mockService");
      return new MockService();
    } else {
      const { Service } = await import("./impl/service");
      return new Service();
    }
  };

  const service = await genService();
  service.setupSatisfactoryApiCheck();

  const app = express();
  app.use(cors());
  app.use(morgan("dev"));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  const context = {} as RouteContext;

  const routes = makeRoutes(service, context);

  routes.forEach((route) => {
    app[route.method](route.path, route.handler);
  });

  return app;
};
