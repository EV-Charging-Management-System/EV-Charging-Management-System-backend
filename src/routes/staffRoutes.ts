import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { staffController } from "../controllers/staffController"

const router = Router()

router.use(authenticate)
router.use(authorize(["STAFF"]))

router.get("/vehicle/:licensePlate", staffController.getVehicleByPlate)
router.post("/session/start", staffController.startDirectSession)
router.patch("/session/:sessionId/end", staffController.endDirectSession)
router.post("/payment", staffController.processDirectPayment)
router.get("/station/:stationId/sessions", staffController.getStationSessions)
router.post("/session/:sessionId/penalty", staffController.addPenalty)

export { router as staffRoutes }
