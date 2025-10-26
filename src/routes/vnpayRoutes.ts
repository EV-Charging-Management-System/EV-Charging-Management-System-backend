import { Router } from "express"
import { vnpayController } from "../controllers/vnpayController"
import { authenticate, authorize } from "../middlewares/authMiddleware"

const router = Router()

// Create VNPAY payment URL (requires auth; allow all roles)
router.post(
	"/create",
	authenticate,
	authorize(["ADMIN", "STAFF", "EVDRIVER", "BUSINESS"]),
	vnpayController.createPaymentUrl
)

// VNPAY Return & IPN (public endpoints called by VNPAY)
router.get("/return", vnpayController.vnpReturn)
router.get("/ipn", vnpayController.vnpIpn)

export { router as vnpayRoutes }
