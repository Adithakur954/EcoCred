import express from 'express';
import { getLeaderboard, getUserGamificationStatus } from '../controllers/gamificationController.js';

const router = express.Router();

router.get('/leaderboard', getLeaderboard);
router.get('/status/:userId', getUserGamificationStatus);

export default router;
