import { createServer } from "./server";

const port = process.env.PORT || 3000;
createServer().then((app) => {
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
});
