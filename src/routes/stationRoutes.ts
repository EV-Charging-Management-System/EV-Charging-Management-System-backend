import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { stationController } from '../controllers/StationController'

const router = Router()

router.get('/getStationinfor', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetStatusStation)
router.get('/getAllSations', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetAllStations)
export { router as stationRoutes }
