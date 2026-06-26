ALTER TABLE "Chat" ADD COLUMN "photoURL" TEXT;

ALTER TABLE "ChatMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MEMBER';

WITH ranked_members AS (
  SELECT
    cm."id",
    ROW_NUMBER() OVER (PARTITION BY cm."chatId" ORDER BY cm."joinedAt" ASC, cm."id" ASC) AS member_rank
  FROM "ChatMember" cm
  INNER JOIN "Chat" c ON c."id" = cm."chatId"
  WHERE c."isGroup" = TRUE
)
UPDATE "ChatMember" cm
SET "role" = 'OWNER'
FROM ranked_members rm
WHERE cm."id" = rm."id"
  AND rm.member_rank = 1;

ALTER TABLE "ChatMember"
  ADD CONSTRAINT "ChatMember_role_check"
  CHECK ("role" IN ('OWNER', 'ADMIN', 'MEMBER'));

CREATE INDEX "ChatMember_chatId_role_idx" ON "ChatMember"("chatId", "role");
