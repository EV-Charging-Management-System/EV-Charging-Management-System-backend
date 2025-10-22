import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { vehicleController } from '../controllers/vehicleController'

const router = Router()
router.get('/addVehicle', authenticate, authorize(['EVDRIVER']), vehicleController.addVehicle)

export { router as vehicleRoutes }