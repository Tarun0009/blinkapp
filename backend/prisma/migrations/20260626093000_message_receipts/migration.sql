-- CreateTable
CREATE TABLE "MessageReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageReceipt_pkey" PRIMARY KEY ("id")
);

-- Backfill receipts for existing messages and recipients.
INSERT INTO "MessageReceipt" ("id", "messageId", "userId", "deliveredAt", "readAt", "createdAt", "updatedAt")
SELECT
    'receipt_' || md5(m."id" || ':' || cm."userId"),
    m."id",
    cm."userId",
    CASE
        WHEN m."status" IN ('DELIVERED', 'READ') THEN COALESCE(m."deliveredAt", m."createdAt")
        ELSE NULL
    END,
    CASE
        WHEN m."status" = 'READ' THEN COALESCE(m."readAt", m."deliveredAt", m."createdAt")
        ELSE NULL
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Message" m
JOIN "ChatMember" cm ON cm."chatId" = m."chatId" AND cm."userId" <> m."senderId"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "MessageReceipt_messageId_userId_key" ON "MessageReceipt"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MessageReceipt_userId_readAt_idx" ON "MessageReceipt"("userId", "readAt");

-- CreateIndex
CREATE INDEX "MessageReceipt_messageId_idx" ON "MessageReceipt"("messageId");

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;