export const SATISFACTORY_API_URL = "http://10.1.1.187:8080";
export const USE_MOCK = process.env.USE_MOCK || false;

let satisfactoryApiUp = false;

export const setSatisfactoryApiUp = (up: boolean) => {
  satisfactoryApiUp = up;
};

export const satistactoryApiIsUp = () => {
  return satisfactoryApiUp;
};
