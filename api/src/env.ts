export const SATISFACTORY_API_URL = "http://10.1.1.187:8080";
export const USE_MOCK = process.env.USE_MOCK || false;

let satisfactoryApiUp = false;
let checkedOnce = false;

export const setSatisfactoryApiUp = (up: boolean) => {
  const nowDown = satisfactoryApiUp && !up;
  const nowUp = !satisfactoryApiUp && up;

  if (nowDown || (!checkedOnce && !up)) {
    const red = "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`Satisfactory API is ${red}down${reset}`);
  } else if (nowUp || (!checkedOnce && up)) {
    const green = "\x1b[32m";
    const reset = "\x1b[0m";
    console.log(`Satisfactory API is ${green}up${reset}`);
  }

  checkedOnce = true;
  satisfactoryApiUp = up;
};

export const satistactoryApiIsUp = () => {
  return satisfactoryApiUp;
};
