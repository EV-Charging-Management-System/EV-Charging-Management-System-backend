import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { stationController } from '../controllers/StationController'

const router = Router()

/**
 * @openapi
 * /station/getStationinfor:
 *   get:
 *     tags: [Station]
 *     summary: Get station information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: StationAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Station address to fetch information for
 *     responses:
 *       200:
 *         description: Station information
 *       401:
 *         description: Unauthorized
 */
router.get('/getStationinfor', authenticate, authorize(['Driver']), stationController.GetStatusStation)
/**
 * @openapi
 * /station/getAllSations:
 *   get:
 *     tags: [Station]
 *     summary: Get all stations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stations
 *       401:
 *         description: Unauthorized
 */
router.get('/getAllSations', authenticate, authorize(['Driver']), stationController.GetAllStations)
export { router as stationRoutes }