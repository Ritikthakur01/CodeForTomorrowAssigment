import { Router, Request, Response } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { prisma } from "../db";
import { firestore } from "../firebase";

const router = Router();

interface Message {
  senderId: number;
  text: string;
  createdAt: Timestamp;
  readBy: number[];
}

function messagesRef(chatId: number) {
  return firestore.collection("chats").doc(String(chatId)).collection("messages");
}

// chats live in postgres, so membership is always checked there
async function isChatMember(chatId: number, userId: number): Promise<boolean> {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, OR: [{ userAId: userId }, { userBId: userId }] },
  });
  return chat !== null;
}

router.post("/create", async (req: Request, res: Response) => {
  const { userAId, userBId } = req.body ?? {};
  if (!Number.isInteger(userAId) || !Number.isInteger(userBId)) {
    res.status(400).json({ error: "userAId and userBId must be numbers" });
    return;
  }
  if (userAId === userBId) {
    res.status(400).json({ error: "Cannot create a chat with yourself" });
    return;
  }

  const userCount = await prisma.user.count({ where: { id: { in: [userAId, userBId] } } });
  if (userCount !== 2) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // smaller id first, so A-B and B-A end up as the same row
  const pair = {
    userAId: Math.min(userAId, userBId),
    userBId: Math.max(userAId, userBId),
  };

  // upsert with empty update = create if missing, otherwise return the existing chat
  const chat = await prisma.chat.upsert({
    where: { userAId_userBId: pair },
    update: {},
    create: pair,
  });
  res.json({ chatId: chat.id });
});

router.post("/:chatId/message/send", async (req: Request, res: Response) => {
  const chatId = Number(req.params.chatId);
  const { senderId, text } = req.body ?? {};

  if (!Number.isInteger(chatId) || !Number.isInteger(senderId)) {
    res.status(400).json({ error: "Invalid chatId or senderId" });
    return;
  }
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  if (!(await isChatMember(chatId, senderId))) {
    res.status(403).json({ error: "Sender is not a member of this chat" });
    return;
  }

  const doc = await messagesRef(chatId).add({
    senderId,
    text: text.trim(),
    createdAt: FieldValue.serverTimestamp(),
    readBy: [senderId],
  });

  res.status(201).json({ messageId: doc.id });
});

router.get("/:chatId/messages", async (req: Request, res: Response) => {
  const chatId = Number(req.params.chatId);
  if (!Number.isInteger(chatId)) {
    res.status(400).json({ error: "Invalid chatId" });
    return;
  }

  let limit = Number(req.query.limit) || 50;
  limit = Math.min(Math.max(limit, 1), 100);

  // fetch the latest N, then flip so the response is oldest -> newest
  const snapshot = await messagesRef(chatId).orderBy("createdAt", "desc").limit(limit).get();

  const messages = snapshot.docs
    .map((doc) => {
      const data = doc.data() as Message;
      return {
        messageId: doc.id,
        senderId: data.senderId,
        text: data.text,
        readBy: data.readBy,
        createdAt: data.createdAt.toDate(),
      };
    })
    .reverse();

  res.json({ messages });
});

router.post("/:chatId/message/:messageId/read", async (req: Request, res: Response) => {
  const chatId = Number(req.params.chatId);
  const messageId = String(req.params.messageId);
  const userId = req.body?.userId;

  if (!Number.isInteger(chatId) || !Number.isInteger(userId)) {
    res.status(400).json({ error: "Invalid chatId or userId" });
    return;
  }
  if (!(await isChatMember(chatId, userId))) {
    res.status(403).json({ error: "User is not a member of this chat" });
    return;
  }

  const messageDoc = messagesRef(chatId).doc(messageId);
  if (!(await messageDoc.get()).exists) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  await messageDoc.update({ readBy: FieldValue.arrayUnion(userId) });
  res.json({ success: true });
});

router.post("/:chatId/lastseen", async (req: Request, res: Response) => {
  const chatId = Number(req.params.chatId);
  const { userId, messageId } = req.body ?? {};

  if (!Number.isInteger(chatId) || !Number.isInteger(userId)) {
    res.status(400).json({ error: "Invalid chatId or userId" });
    return;
  }
  if (typeof messageId !== "string" || !messageId) {
    res.status(400).json({ error: "messageId is required" });
    return;
  }
  if (!(await isChatMember(chatId, userId))) {
    res.status(403).json({ error: "User is not a member of this chat" });
    return;
  }
  if (!(await messagesRef(chatId).doc(messageId).get()).exists) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  // one doc per user: chats/{chatId}/lastSeen/{userId}
  await firestore
    .collection("chats")
    .doc(String(chatId))
    .collection("lastSeen")
    .doc(String(userId))
    .set({ messageId, updatedAt: FieldValue.serverTimestamp() });

  res.json({ success: true });
});

export default router;
