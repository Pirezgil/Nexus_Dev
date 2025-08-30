import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  registerCompanySchema,
  updateProfileSchema,
  updatePasswordSchema,
} from '../types';
import { uploadAvatar, handleUploadError } from '../middleware/upload';
import {
  passwordResetRateLimit,
  emailVerificationRateLimit,
  loginRateLimit,
  registrationRateLimit,
  changePasswordRateLimit,
  generalAuthRateLimit,
  tokenValidationRateLimit,
} from '../middleware/authRateLimit';

const router = Router();

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Log rate limiting status with detailed debugging
console.log('🔍 Rate Limiting Debug Info:', {
  NODE_ENV: process.env.NODE_ENV,
  isDevelopment: isDevelopment,
  rateLimitingStatus: isDevelopment ? 'DISABLED' : 'ENABLED'
});

if (isDevelopment) {
  console.log('🚀 Auth route rate limiting disabled in development mode');
} else {
  console.log('🔒 Auth route rate limiting enabled for production');
}

/**
 * @route   POST /auth/register
 * @desc    Register new company with admin user
 * @access  Public
 */
router.post('/register', 
  ...(isDevelopment ? [] : [registrationRateLimit]),
  validate(registerCompanySchema), 
  AuthController.register
);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
if (isDevelopment) {
  // Development: No rate limiting
  router.post('/login', 
    validate(loginSchema), 
    AuthController.login
  );
} else {
  // Production: With rate limiting
  router.post('/login', 
    loginRateLimit,
    validate(loginSchema), 
    AuthController.login
  );
}

/**
 * @route   POST /auth/logout
 * @desc    Logout user (revoke current session)
 * @access  Private
 */
router.post('/logout', 
  authenticate, 
  AuthController.logout
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', 
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  validate(refreshTokenSchema), 
  AuthController.refreshToken
);

/**
 * @route   GET /auth/validate
 * @desc    Validate token for other modules
 * @access  Public (but requires valid token)
 */
router.get('/validate', 
  ...(isDevelopment ? [] : [tokenValidationRateLimit]),
  AuthController.validate
);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', 
  authenticate,
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  AuthController.me
);

/**
 * @route   POST /auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', 
  ...(isDevelopment ? [] : [passwordResetRateLimit]),
  validate(forgotPasswordSchema), 
  AuthController.forgotPassword
);

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', 
  ...(isDevelopment ? [] : [passwordResetRateLimit]),
  validate(resetPasswordSchema), 
  AuthController.resetPassword
);

/**
 * @route   POST /auth/change-password
 * @desc    Change current user password
 * @access  Private
 */
router.post('/change-password', 
  authenticate,
  ...(isDevelopment ? [] : [changePasswordRateLimit]),
  validate(changePasswordSchema), 
  AuthController.changePassword
);

/**
 * @route   POST /auth/revoke-all-sessions
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/revoke-all-sessions', 
  authenticate,
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  AuthController.revokeAllSessions
);

/**
 * @route   POST /auth/check-email
 * @desc    Check if email exists (for frontend validation)
 * @access  Public
 */
router.post('/check-email', 
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  AuthController.checkEmail
);

/**
 * @route   GET /auth/verify-email/:token
 * @desc    Verify email address using token
 * @access  Public
 */
router.get('/verify-email/:token',
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  AuthController.verifyEmail
);

/**
 * @route   POST /auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend-verification',
  ...(isDevelopment ? [] : [emailVerificationRateLimit]),
  AuthController.resendEmailVerification
);

/**
 * @route   PATCH /auth/profile
 * @desc    Update user profile (name, phone)
 * @access  Private
 */
router.patch('/profile',
  authenticate,
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  validate(updateProfileSchema),
  AuthController.updateProfile
);

/**
 * @route   PATCH /auth/password
 * @desc    Update user password
 * @access  Private
 */
router.patch('/password',
  authenticate,
  ...(isDevelopment ? [] : [changePasswordRateLimit]),
  validate(updatePasswordSchema),
  AuthController.updatePassword
);

/**
 * @route   POST /auth/avatar
 * @desc    Upload and update user avatar
 * @access  Private
 */
router.post('/avatar',
  authenticate,
  ...(isDevelopment ? [] : [generalAuthRateLimit]),
  uploadAvatar,
  handleUploadError,
  AuthController.updateAvatar
);

export default router;