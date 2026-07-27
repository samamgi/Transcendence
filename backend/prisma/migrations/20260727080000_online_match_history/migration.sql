CREATE TYPE "MatchMode" AS ENUM ('ONLINE');

CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "mode" "MatchMode" NOT NULL DEFAULT 'ONLINE',
    "leftPlayerId" INTEGER NOT NULL,
    "rightPlayerId" INTEGER NOT NULL,
    "winnerId" INTEGER NOT NULL,
    "leftScore" INTEGER NOT NULL,
    "rightScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Match_leftPlayerId_idx"
ON "Match"("leftPlayerId");

CREATE INDEX "Match_rightPlayerId_idx"
ON "Match"("rightPlayerId");

CREATE INDEX "Match_winnerId_idx"
ON "Match"("winnerId");

CREATE INDEX "Match_finishedAt_idx"
ON "Match"("finishedAt");

ALTER TABLE "Match"
ADD CONSTRAINT "Match_leftPlayerId_fkey"
FOREIGN KEY ("leftPlayerId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_rightPlayerId_fkey"
FOREIGN KEY ("rightPlayerId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_winnerId_fkey"
FOREIGN KEY ("winnerId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
