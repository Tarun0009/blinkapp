-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN "mediaUrl" TEXT,
ADD COLUMN "mediaMimeType" TEXT,
ADD COLUMN "mediaSize" INTEGER,
ADD COLUMN "mediaName" TEXT;

-- CreateIndex
CREATE INDEX "Message_type_idx" ON "Message"("type");