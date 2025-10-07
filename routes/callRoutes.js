const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
router.get('/dbcheck', callController.getDbCheck);

router.get('/call-lengths', callController.getCallLengths);

router.get('/call-rates', callController.getCallRates);
router.get('/avg-call-time', callController.getAvgCallTime);
router.get('/answer-machine-detection', callController.getAnswerMachineDetection);
router.get('/concurrent-calls', callController.getConcurrentCalls);
router.get('/peak-call-times', callController.getPeakCallTimes);
router.get('/total-call-time', callController.getTotalCallTime);
router.get('/billing-table', callController.getBillingTable);

module.exports = router;
