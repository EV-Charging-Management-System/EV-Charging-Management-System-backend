import { Router } from 'express'
import { adminController } from '../controllers/adminController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

// All admin routes require authentication and admin role
router.use(authenticate)
router.use(authorize(['Admin']))

// Dashboard
/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/dashboard', authenticate, adminController.getDashboardStats)

// User Management

export { router as adminRoutes }
