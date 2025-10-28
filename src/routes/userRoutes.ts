import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { userController } from '../controllers/userController'

const router = Router()

// List and detail - admin/staff
router.get('/', authenticate, authorize(['ADMIN','STAFF']), userController.getAll)
router.get('/:id', authenticate, authorize(['ADMIN','STAFF']), userController.getById)

// Update - owner or admin/staff (ownership check in controller)
router.put('/:id', authenticate, userController.update)

// Delete - admin only
router.delete('/:id', authenticate, authorize(['ADMIN']), userController.delete)

// Approve business account - admin only
router.patch('/:id/approve', authenticate, authorize(['ADMIN']), userController.approve)

export { router as userRoutes }
