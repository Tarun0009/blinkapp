-- CreateTable
CREATE TABLE "ChatPreference" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatPreference_userId_idx" ON "ChatPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPreference_chatId_userId_key" ON "ChatPreference"("chatId", "userId");

-- AddForeignKey
ALTER TABLE "ChatPreference" ADD CONSTRAINT "ChatPreference_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPreference" ADD CONSTRAINT "ChatPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
