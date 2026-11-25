# Chat Backend

A simple 1:1 chat backend built with Node.js, TypeScript, PostgreSQL (Prisma) and Firebase Firestore.

- Users and chats are stored in PostgreSQL (models are in `prisma/schema.prisma`)
- Messages, read receipts and last seen are stored in Firestore

## Setup

1. Install dependencies

   ```
   npm install
   ```

2. Create a PostgreSQL database (for example `chat_db`).

3. Create a Firebase project, enable Firestore, then download a service account key
   (Project settings > Service accounts > Generate new private key) and save it as
   `serviceAccountKey.json` in the project root.

4. Copy `.env.example` to `.env` and update the values.

5. Create the tables with Prisma

   ```
   npx prisma migrate dev --name init
   ```

6. Start the server

   ```
   npm run dev
   ```

   For production: `npm run build` and then `npm start`.

## APIs

| Method | Route | Body | Description |
| --- | --- | --- | --- |
| POST | `/user/create` | `{ "name": "John" }` | Create a user (helper for testing) |
| POST | `/chat/create` | `{ "userAId": 1, "userBId": 2 }` | Create a chat or return the existing one |
| POST | `/chat/:chatId/message/send` | `{ "senderId": 1, "text": "Hello" }` | Send a message |
| GET | `/chat/:chatId/messages?limit=50` | - | Latest messages, ordered by timestamp |
| POST | `/chat/:chatId/message/:messageId/read` | `{ "userId": 2 }` | Mark a message as read |
| POST | `/chat/:chatId/lastseen` | `{ "userId": 2, "messageId": "abc" }` | Update last seen message of a user |
| GET | `/user/:userId/chats` | - | List chats of a user with member ids |

## Firestore structure

```
chats/{chatId}/messages/{messageId}
  senderId, text, createdAt, readBy[]

chats/{chatId}/lastSeen/{userId}
  messageId, updatedAt
```

`readBy` is an array of user ids who have read the message. The sender is added to it when the message is sent.

## Notes

- For a 1:1 chat the smaller user id is always stored in `user_a_id`, and there is a unique
  constraint on the pair, so the same two users can never get two chats.
- Before writing anything to Firestore, the API checks in PostgreSQL that the user is a member of the chat.
