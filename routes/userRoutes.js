import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  searchUsers
} from '../controllers/userController.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateId
} from '../middleware/validateUser.js';

const router = express.Router();

// GET all users
router.get('/', getAllUsers);

// SEARCH users
router.get('/search', searchUsers);

// GET user by ID
router.get('/:id', validateId, getUserById);

// CREATE new user
router.post('/', validateCreateUser, createUser);

// UPDATE user
router.put('/:id', validateId, validateUpdateUser, updateUser);

// DELETE user
router.delete('/:id', validateId, deleteUser);

export default router;
