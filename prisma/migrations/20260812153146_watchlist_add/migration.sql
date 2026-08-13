-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('PLANNED', 'WATCHING', 'COMPLETED', 'DROPPED');

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "description" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WatchList" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "movieId" INTEGER NOT NULL,
    "status" "WatchStatus" NOT NULL DEFAULT 'PLANNED',
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchList_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WatchList" ADD CONSTRAINT "WatchList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchList" ADD CONSTRAINT "WatchList_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
