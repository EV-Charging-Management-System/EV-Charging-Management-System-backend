import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { companyController } from '../controllers/companyController'

const router = Router()

// Public list? For now require authentication for all operations
router.get('/', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), companyController.getAll)
router.get('/:id', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), companyController.getById)
router.post('/', authenticate, authorize(['ADMIN','STAFF']), companyController.create)
router.put('/:id', authenticate, authorize(['ADMIN','BUSINESS']), companyController.update)
router.delete('/:id', authenticate, authorize(['ADMIN']), companyController.delete)

export { router as companyRoutes }
