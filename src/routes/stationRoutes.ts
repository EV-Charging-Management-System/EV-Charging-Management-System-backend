import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { stationController } from '@/controllers/StationController'

const router = Router()

router.post('/getStationinfor', authenticate, authorize(['User']), stationController.GetStatusStation)
export { router as stationRoutes }