-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('PRIVATE', 'GROUP');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "name" TEXT,
ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'PRIVATE';

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
