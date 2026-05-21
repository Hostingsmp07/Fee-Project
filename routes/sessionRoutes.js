const express = require('express');
const {
  getSessions,
  createSession,
} = require('../controllers/sessionController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getSessions);
router.post('/', createSession);

module.exports = router;