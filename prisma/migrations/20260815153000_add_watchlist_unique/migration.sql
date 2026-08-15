-- CreateIndex
CREATE UNIQUE INDEX "WatchList_userId_movieId_key" ON "WatchList"("userId", "movieId");
