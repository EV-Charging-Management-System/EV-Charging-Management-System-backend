import { Router } from 'express'
import {
  // forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  PasswordChangeHandler,
  refreshAccessTokenHandler,
  registerHandler
  // resetPasswordHandler
} from '../controllers/authController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

// Public routes
/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 */
router.post('/register', registerHandler)
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive access and refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginHandler)
/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh the access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: New access token
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh-token', refreshAccessTokenHandler)
/**
 * @openapi
 * /auth/logout:
 *   delete:
 *     tags: [Auth]
 *     summary: Logout the current user (invalidate refresh token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out
 *       401:
 *         description: Unauthorized
 */
router.delete('/logout', authenticate, logoutHandler)
// //  Forgot Password routes
// router.post('/forgot-password', forgotPasswordHandler)
// router.post('/reset-password', resetPasswordHandler)
// Protected routes
/**
 * @openapi
 * /auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change password for authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.put('/change-password', authenticate, PasswordChangeHandler)


export default router

