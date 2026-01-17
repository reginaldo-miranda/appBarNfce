import express from 'express';
import { emitirNfce, getDetails, generatePdf } from '../controllers/NfceController.js';

const router = express.Router();

router.post('/emitir', emitirNfce);
router.get('/:saleId/pdf', generatePdf);
router.get('/:saleId', getDetails);

export default router;
