import express from 'express';
import {
  register,
  login,
  getMe,
  updatePassword,
  logout
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validateCreateUser } from '../middleware/validateUser.js';

const router = express.Router();

// Public routes
router.post('/register', validateCreateUser, register);
router.post('/login', login);

// Protected routes (require authentication)
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);
router.post('/logout', protect, logout);

export default router;