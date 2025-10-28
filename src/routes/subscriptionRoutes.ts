import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { subscriptionController } from '../controllers/subscriptionController'

const router = Router()

router.get('/', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), subscriptionController.getAll)
router.get('/:id', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), subscriptionController.getById)
router.post('/', authenticate, subscriptionController.create)
router.put('/:id', authenticate, authorize(['ADMIN','STAFF']), subscriptionController.update)
router.delete('/:id', authenticate, authorize(['ADMIN','STAFF']), subscriptionController.delete)

router.post('/buy', authenticate, authorize(['EVDRIVER']), subscriptionController.buy)
router.post('/buy-company', authenticate, authorize(['BUSINESS']), subscriptionController.buyCompany)
router.get('/status', authenticate, subscriptionController.status)
router.post('/renew', authenticate, authorize(['EVDRIVER','BUSINESS','STAFF']), subscriptionController.renew)
router.post('/cancel', authenticate, authorize(['EVDRIVER','BUSINESS','STAFF']), subscriptionController.cancel)

export { router as subscriptionRoutes }
