import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { bookingController } from "../controllers/bookingController"

const router = Router()

router.post("/", authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), bookingController.createBooking)
router.get("/txn/:txnRef", authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), bookingController.getBookingByTxnRef)
router.get("/payment/:paymentId", authenticate, authorize(['ADMIN','BUSINESS','STAFF','EVDRIVER']), bookingController.getBookingByPaymentId)
router.get("/my", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getUserBookings)
router.get("/station/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getBookingsByStationId)
router.get("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getBookingDetails)
router.delete("/:id/cancel", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.cancelBooking)
router.patch("/:id/checkout", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.checkoutBooking)
router.get("/available/slots", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getAvailableSlots)

export { router as bookingRoutes }
