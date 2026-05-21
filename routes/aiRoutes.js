const express = require('express');
const { suggestGoal, generatePlan, chatStream } = require('../controllers/aiController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/suggest', suggestGoal);
router.post('/generate', generatePlan);
router.post('/chat', chatStream);

module.exports = router;