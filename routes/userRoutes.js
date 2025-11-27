import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  searchUsers,
  getUserStats,
  getUserWithDevices
} from '../controllers/userController.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateId
} from '../middleware/validateUser.js';

const router = express.Router();

// GET user statistics
router.get('/stats', getUserStats);

// SEARCH users
router.get('/search', searchUsers);

// GET all users
router.get('/', getAllUsers);

// GET user with devices
router.get('/:id/devices', validateId, getUserWithDevices);

// GET user by ID
router.get('/:id', validateId, getUserById);

// CREATE new user
router.post('/', validateCreateUser, createUser);

// UPDATE user
router.put('/:id', validateId, validateUpdateUser, updateUser);

// DELETE user
router.delete('/:id', validateId, deleteUser);

export default router;