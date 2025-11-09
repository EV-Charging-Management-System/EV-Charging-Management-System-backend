import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { stationController } from '../controllers/StationController'

const router = Router()

router.post('/getStationinfor', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetStatusStation)
router.get('/getAllStations', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetAllStations)
router.get('/getPoint', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetPoint)
router.get('/getPort', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetPort)
router.get('/getPortById/:id', authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), stationController.GetPortById)

export { router as stationRoutes }
