import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { chargingSessionController } from "../controllers/chargingSessionController"

const router = Router()

// Charging session routes
router.post("/start", authenticate, authorize(["EVDRIVER", "BUSINESS_DRIVER"]), chargingSessionController.startSession)
router.post(
  "/end/:sessionId",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  chargingSessionController.endSession,
)
router.get(
  "/details/:sessionId",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  chargingSessionController.getSessionDetails,
)
router.get(
  "/my-sessions",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  chargingSessionController.getUserSessions,
)
router.get(
  "/penalty/:sessionId",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  chargingSessionController.calculatePenalty,
)

export { router as chargingSessionRoutes }
