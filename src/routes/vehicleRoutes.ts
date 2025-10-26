import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { vehicleController } from "../controllers/vehicleController"

const router = Router()

router.get("/", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.getVehicles)
router.post("/", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.addVehicle)
router.get("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.getVehicleById)
router.patch("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.updateVehicle)
router.delete("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.deleteVehicle)

export { router as vehicleRoutes }
