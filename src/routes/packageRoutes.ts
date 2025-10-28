import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { packageController } from '../controllers/packageController'

const router = Router()

// List and detail available to authenticated users
router.get('/', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), packageController.getAll)
router.get('/:id', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), packageController.getById)
// Create/update/delete restricted to ADMIN or STAFF
router.post('/', authenticate, authorize(['ADMIN','STAFF']), packageController.create)
router.put('/:id', authenticate, authorize(['ADMIN','STAFF']), packageController.update)
router.delete('/:id', authenticate, authorize(['ADMIN']), packageController.delete)

export { router as packageRoutes }
