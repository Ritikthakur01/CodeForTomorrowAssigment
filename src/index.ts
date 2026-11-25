import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import chatRoutes from "./routes/chat";
import userRoutes from "./routes/user";

const app = express();
app.use(express.json());

app.use("/chat", chatRoutes);
app.use("/user", userRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
