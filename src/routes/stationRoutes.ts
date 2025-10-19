import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { stationController } from '../controllers/StationController'

const router = Router()

router.get('/getStationinfor', authenticate, authorize(['EVDRIVER']), stationController.GetStatusStation)
router.get('/getAllSations', authenticate, authorize(['EVDRIVER']), stationController.GetAllStations)
router.post('/getMaybe', authenticate, authorize(['EVDRIVER']), stationController.GetStatusStation)
export { router as stationRoutes }