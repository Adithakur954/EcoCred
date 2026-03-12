import express from 'express';
import { logUsageEvent, getUsageSummary } from '../controllers/usageController.js';

const router = express.Router();

router.post('/', logUsageEvent);
router.get('/summary/:userId', getUsageSummary);

export default router;
