import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { paymentController } from "../controllers/paymentController"

const router = Router()

// Payment routes
router.post("/process", authenticate, authorize(["EVDRIVER", "BUSINESS_DRIVER"]), paymentController.processPayment)
router.get("/history", authenticate, authorize(["EVDRIVER", "BUSINESS_DRIVER"]), paymentController.getPaymentHistory)
router.get("/pending", authenticate, authorize(["EVDRIVER", "BUSINESS_DRIVER"]), paymentController.getPendingPayments)
router.post(
  "/pay-pending",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  paymentController.payPendingBalance,
)

export { router as paymentRoutes }
