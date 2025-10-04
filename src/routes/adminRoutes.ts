import { Router } from 'express'
import { adminController } from '../controllers/adminController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

// All admin routes require authentication and admin role
router.use(authenticate)
router.use(authorize(['Admin']))

// Dashboard
router.get('/dashboard', authenticate, adminController.getDashboardStats)

// User Management
router.get('/users', authenticate, adminController.getAllUsers)
router.put('/users/:userId/role', authenticate, adminController.updateUserRole)
router.get('/users/:userId', authenticate, adminController.getUserById)
router.delete('/users/:userId', authenticate, adminController.deleteUser)

// Service Management
router.get('/services', authenticate, adminController.getAllServices)
router.post('/services', authenticate, adminController.createService)
router.put('/services/:serviceId', authenticate, adminController.updateService)
router.delete('/services/:serviceId', authenticate, adminController.deleteService)

export { router as adminRoutes }
