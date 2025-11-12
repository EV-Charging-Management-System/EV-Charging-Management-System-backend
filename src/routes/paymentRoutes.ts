import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { paymentController } from "../controllers/paymentController"

const router = Router()

router.post("/", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), paymentController.processPayment)
router.get("/history", authenticate, authorize(["EVDRIVER", "BUSINESS"]), paymentController.getPaymentHistory)
router.get("/invoices", authenticate, authorize(["EVDRIVER", "BUSINESS"]), paymentController.getInvoices)
router.get("/company/:companyId", authenticate, authorize(["BUSINESS"]), paymentController.getCompanyInvoices)
router.get("/pending", authenticate, authorize(["EVDRIVER", "BUSINESS"]), paymentController.getPendingPayments)
router.patch("/:id/pay", authenticate, authorize(["EVDRIVER","STAFF", "BUSINESS"]), paymentController.payInvoice)
router.get("/report", authenticate, authorize(["EVDRIVER", "BUSINESS"]), paymentController.getMonthlyReport)
router.post("/pay-all", authenticate, authorize(["EVDRIVER", "BUSINESS"]), paymentController.payAll)

export { router as paymentRoutes }
