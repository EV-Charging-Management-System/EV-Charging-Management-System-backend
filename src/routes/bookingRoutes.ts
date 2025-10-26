import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { bookingController } from "../controllers/bookingController"

const router = Router()

router.post("/", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.createBooking)
router.get("/my", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getUserBookings)
router.get("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getBookingDetails)
router.delete("/:id/cancel", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.cancelBooking)
router.patch("/:id/checkout", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.checkoutBooking)
router.get("/available/slots", authenticate, authorize(["EVDRIVER", "BUSINESS"]), bookingController.getAvailableSlots)

export { router as bookingRoutes }
