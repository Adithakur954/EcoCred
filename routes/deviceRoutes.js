import express from 'express';
import {
  getAllDevices,
  getDeviceById,
  getDevicesByStatus,
  getDeviceStats,
  createDevice,
  updateDevice,
  updateDeviceStatus,
  deleteDevice,
  getDevicesByUser,
  searchDevices
} from '../controllers/deviceController.js';
import {
  validateCreateDevice,
  validateUpdateDevice,
  validateStatusUpdate,
  validateId
} from '../middleware/validateDevice.js';

const router = express.Router();

// GET all devices
router.get('/', getAllDevices);

// GET device statistics
router.get('/stats', getDeviceStats);

// SEARCH devices
router.get('/search', searchDevices);

// GET devices by status
router.get('/status/:status', getDevicesByStatus);

// GET devices by user
router.get('/user/:userId', getDevicesByUser);

// GET device by ID
router.get('/:id', validateId, getDeviceById);

// CREATE new device
router.post('/', validateCreateDevice, createDevice);

// UPDATE device
router.put('/:id', validateId, validateUpdateDevice, updateDevice);

// UPDATE device status only
router.patch('/:id/status', validateId, validateStatusUpdate, updateDeviceStatus);

// DELETE device
router.delete('/:id', validateId, deleteDevice);

export default router;