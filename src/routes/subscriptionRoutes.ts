import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { subscriptionController } from '../controllers/subscriptionController'

const router = Router()

// List and detail for authenticated users
router.get('/', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), subscriptionController.getAll)
router.get('/:id', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), subscriptionController.getById)

// Create by authenticated users (individual user or business)
router.post('/', authenticate, subscriptionController.create)

// Update/Delete restricted to ADMIN or STAFF
router.put('/:id', authenticate, authorize(['ADMIN','STAFF']), subscriptionController.update)
router.delete('/:id', authenticate, authorize(['ADMIN','STAFF']), subscriptionController.delete)

export { router as subscriptionRoutes }
