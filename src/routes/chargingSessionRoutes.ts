import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { chargingSessionController } from "../controllers/chargingSessionController"

const router = Router()

router.post("/start", authenticate, authorize(["EVDRIVER", "BUSINESS"]), chargingSessionController.startSession)
router.patch("/:id/end", authenticate, authorize(["EVDRIVER", "BUSINESS"]), chargingSessionController.endSession)
router.get("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), chargingSessionController.getSessionDetails)
router.get("/my/sessions", authenticate, authorize(["EVDRIVER", "BUSINESS"]), chargingSessionController.getUserSessions)
router.get("/company/:companyId", authenticate, authorize(["BUSINESS"]), chargingSessionController.getCompanySessions)
router.post("/:id/penalty", authenticate, authorize(["STAFF", "ADMIN"]), chargingSessionController.addPenalty)
router.get("/:id/price", authenticate, chargingSessionController.calculateSessionPrice)

export { router as chargingSessionRoutes }
