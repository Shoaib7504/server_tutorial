import express from "express";
import addToWatchList from "../controller/watchlistController.js";

const router = express.Router();

router.post('/',addToWatchList);

export default router