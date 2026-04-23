import express from 'express';
import { analyzeCode, getHistory } from '../controllers/analyzeController.js';

const router = express.Router();

router.post('/analyze', analyzeCode);
router.get('/history', getHistory);

export default router;
