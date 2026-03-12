import express from 'express';
import { getEcoTips } from '../controllers/tipsController.js';

const router = express.Router();

router.get('/', getEcoTips);

export default router;
