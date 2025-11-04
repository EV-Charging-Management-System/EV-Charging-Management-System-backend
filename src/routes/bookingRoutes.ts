import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { bookingController } from "../controllers/bookingController"

const router = Router()

router.post("/", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.createBooking)
router.get("/my", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.getUserBookings)
router.get("/station/:id", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.getBookingsByStationId)
router.get("/:id", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.getBookingDetails)
router.delete("/:id/cancel", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.cancelBooking)
router.patch("/:id/checkout", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.checkoutBooking)
router.get("/available/slots", authenticate, authorize(["EVDRIVER", "STAFF", "BUSINESS"]), bookingController.getAvailableSlots)

export { router as bookingRoutes }
