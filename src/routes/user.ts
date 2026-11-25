import { Router, Request, Response } from "express";
import { prisma } from "../db";

const router = Router();

// not part of the task, but needed to have users to chat with
router.post("/create", async (req: Request, res: Response) => {
  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const user = await prisma.user.create({ data: { name: name.trim() } });
  res.status(201).json({ id: user.id, name: user.name });
});

router.get("/:userId/chats", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const rows = await prisma.chat.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: "desc" },
  });

  const chats = rows.map((chat) => ({
    chatId: chat.id,
    memberIds: [chat.userAId, chat.userBId],
    createdAt: chat.createdAt,
  }));

  res.json({ chats });
});

export default router;
