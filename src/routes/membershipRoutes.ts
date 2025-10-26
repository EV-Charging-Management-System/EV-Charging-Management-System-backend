import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { membershipController } from "../controllers/membershipController"

const router = Router()

router.get("/packages", authenticate, membershipController.getPackages)
router.get("/packages/:id", authenticate, membershipController.getPackageById)
router.post("/packages", authenticate, authorize(["ADMIN"]), membershipController.createPackage)
router.patch("/packages/:id", authenticate, authorize(["ADMIN"]), membershipController.updatePackage)
router.delete("/packages/:id", authenticate, authorize(["ADMIN"]), membershipController.deletePackage)
router.post("/subscribe", authenticate, authorize(["EVDRIVER", "BUSINESS"]), membershipController.purchaseSubscription)
router.get("/my", authenticate, authorize(["EVDRIVER", "BUSINESS"]), membershipController.getUserSubscription)
router.get("/company/:id", authenticate, authorize(["BUSINESS"]), membershipController.getCompanySubscription)
router.patch("/:id/renew", authenticate, authorize(["EVDRIVER", "BUSINESS"]), membershipController.renewSubscription)
router.delete("/:id/cancel", authenticate, authorize(["EVDRIVER", "BUSINESS"]), membershipController.cancelSubscription)

export { router as membershipRoutes }
