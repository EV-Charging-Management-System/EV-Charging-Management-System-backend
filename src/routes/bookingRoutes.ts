import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { bookingController } from "../controllers/bookingController"

const router = Router()

// Booking routes
router.post("/create", authenticate, authorize(["EVDRIVER", "BUSINESS_DRIVER"]), bookingController.createBooking)
router.get("/my-bookings", authenticate, authorize(["EVDRIVER", "BUSINESS_DRIVER"]), bookingController.getUserBookings)
router.get(
  "/details/:bookingId",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  bookingController.getBookingDetails,
)
router.delete(
  "/cancel/:bookingId",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  bookingController.cancelBooking,
)
router.get(
  "/available-slots",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  bookingController.getAvailableSlots,
)

export { router as bookingRoutes }
