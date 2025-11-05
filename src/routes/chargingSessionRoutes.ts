import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { chargingSessionController } from "../controllers/chargingSessionController"

const router = Router()

router.post("/start", authenticate, authorize(["EVDRIVER","BUSINESS"]), chargingSessionController.startSession)
router.patch("/:id/end", authenticate, authorize(["EVDRIVER","BUSINESS"]), chargingSessionController.endSession)
// router.post("/:id/invoice", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.generateInvoice)
router.get("/:id", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.getSessionDetails)
router.get("/my/sessions", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.getUserSessions)
router.get("/company/:companyId", authenticate, authorize(["BUSINESS"]), chargingSessionController.getCompanySessions)
// router.post("/:id/penalty", authenticate, authorize(["STAFF", "ADMIN"]), chargingSessionController.addPenalty)
// router.get("/:id/price", authenticate, chargingSessionController.calculateSessionPrice)
router.post("/staff/start", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.startSessionByStaff)
router.patch("/staff/:id/end", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.endSessionByStaff)
router.post("/guest/start", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.startSessionForGuest)
router.patch("/guest/:id/end", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.endSessionForGuest)
router.get("/:id/guest", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), chargingSessionController.getSessionDetailsGuest)
export { router as chargingSessionRoutes }
