CREATE TYPE "GameMatchMode" AS ENUM (
  'ONLINE',
  'AI'
);

CREATE TYPE "GameMatchEndReason" AS ENUM (
  'NORMAL',
  'FORFEIT'
);

CREATE TABLE "GameMatch" (
  "id" SERIAL NOT NULL,
  "mode" "GameMatchMode" NOT NULL,
  "endReason" "GameMatchEndReason" NOT NULL DEFAULT 'NORMAL',
  "player1Id" INTEGER NOT NULL,
  "player2Id" INTEGER,
  "winnerId" INTEGER,
  "player1Score" INTEGER NOT NULL,
  "player2Score" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameMatch_player1Id_idx"
ON "GameMatch"("player1Id");

CREATE INDEX "GameMatch_player2Id_idx"
ON "GameMatch"("player2Id");

CREATE INDEX "GameMatch_winnerId_idx"
ON "GameMatch"("winnerId");

CREATE INDEX "GameMatch_finishedAt_idx"
ON "GameMatch"("finishedAt");

ALTER TABLE "GameMatch"
ADD CONSTRAINT "GameMatch_player1Id_fkey"
FOREIGN KEY ("player1Id")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "GameMatch"
ADD CONSTRAINT "GameMatch_player2Id_fkey"
FOREIGN KEY ("player2Id")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "GameMatch"
ADD CONSTRAINT "GameMatch_winnerId_fkey"
FOREIGN KEY ("winnerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
