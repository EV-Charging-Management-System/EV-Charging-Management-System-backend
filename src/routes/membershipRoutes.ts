import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { membershipController } from "../controllers/membershipController"

const router = Router()

// Membership routes
router.get("/packages", authenticate, membershipController.getMembershipPackages)
router.post(
  "/purchase",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  membershipController.purchaseMembership,
)
router.get(
  "/my-membership",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  membershipController.getUserMembership,
)
router.get(
  "/check-validity",
  authenticate,
  authorize(["EVDRIVER", "BUSINESS_DRIVER"]),
  membershipController.checkMembershipValidity,
)

export { router as membershipRoutes }
