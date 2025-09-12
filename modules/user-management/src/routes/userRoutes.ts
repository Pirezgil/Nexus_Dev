import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { validate } from '../middleware/validation';
import { 
  authenticate, 
  adminOnly, 
  adminOrManager,
  enforceCompanyAccess 
} from '../middleware/auth';
import {
  createUserSchema,
  updateUserSchema,
  paginationSchema,
  loginSchema,
} from '../types';

const router = Router();

// Public routes (no authentication required)
/**
 * @route   POST /users/login
 * @desc    User login
 * @access  Public
 */
router.post('/login', 
  validate(loginSchema),
  UserController.login
);

// Apply authentication to all remaining routes
router.use(authenticate);
router.use(enforceCompanyAccess);

/**
 * @route   POST /users/logout
 * @desc    User logout
 * @access  Private
 */
router.post('/logout', UserController.logout);

/**
 * @route   GET /users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', UserController.getProfile);

/**
 * @route   PUT /users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', 
  validate(updateUserSchema), 
  UserController.updateProfile
);

/**
 * @route   GET /users/stats
 * @desc    Get user statistics for dashboard
 * @access  Private (Admin/Manager only)
 */
router.get('/stats', 
  adminOrManager, 
  UserController.getUserStats
);

/**
 * @route   GET /users/search
 * @desc    Search users with query parameters
 * @access  Private (Admin/Manager only)
 */
router.get('/search', 
  adminOrManager,
  validate(paginationSchema, 'query'),
  UserController.searchUsers
);

/**
 * @route   POST /users
 * @desc    Create new user
 * @access  Private (Admin/Manager only)
 */
router.post('/', 
  adminOrManager,
  validate(createUserSchema), 
  UserController.createUser
);

/**
 * @route   GET /users
 * @desc    Get all users with pagination
 * @access  Private (Admin/Manager only)
 */
router.get('/', 
  adminOrManager,
  validate(paginationSchema, 'query'),
  UserController.getUsers
);

/**
 * @route   GET /users/:id
 * @desc    Get user by ID
 * @access  Private (Admin/Manager only)
 */
router.get('/:id', 
  adminOrManager, 
  UserController.getUserById
);

/**
 * @route   PUT /users/:id
 * @desc    Update user
 * @access  Private (Admin/Manager only)
 */
router.put('/:id', 
  adminOrManager,
  validate(updateUserSchema), 
  UserController.updateUser
);

/**
 * @route   DELETE /users/:id
 * @desc    Delete user (soft delete)
 * @access  Private (Admin only)
 */
router.delete('/:id', 
  adminOnly, 
  UserController.deleteUser
);

/**
 * @route   POST /users/:id/activate
 * @desc    Activate user
 * @access  Private (Admin/Manager only)
 */
router.post('/:id/activate', 
  adminOrManager, 
  UserController.activateUser
);

/**
 * @route   POST /users/:id/deactivate
 * @desc    Deactivate user
 * @access  Private (Admin/Manager only)
 */
router.post('/:id/deactivate', 
  adminOrManager, 
  UserController.deactivateUser
);

/**
 * @route   POST /users/:id/reset-password
 * @desc    Reset user password (admin action)
 * @access  Private (Admin only)
 */
router.post('/:id/reset-password', 
  adminOnly, 
  UserController.resetUserPassword
);

export default router;