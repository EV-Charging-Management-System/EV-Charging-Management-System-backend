import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { companyController } from '../controllers/companyController'

const router = Router()

<<<<<<< HEAD
// Require authentication for all operations
=======
// Public list? For now require authentication for all operations
>>>>>>> 869ccea (company+package +subscription)
router.get('/', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), companyController.getAll)
router.get('/:id', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), companyController.getById)
router.post('/', authenticate, authorize(['ADMIN','STAFF']), companyController.create)
router.put('/:id', authenticate, authorize(['ADMIN','BUSINESS']), companyController.update)
router.delete('/:id', authenticate, authorize(['ADMIN']), companyController.delete)

export { router as companyRoutes }
