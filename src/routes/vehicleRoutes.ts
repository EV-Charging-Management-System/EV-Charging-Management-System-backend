import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { vehicleController } from "../controllers/vehicleController"

const router = Router()

router.get("/", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.getVehicles)
router.post("/", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.addVehicle)
// Register or update vehicle by license plate
router.post(
	"/register-by-plate",
	authenticate,
	authorize(["EVDRIVER", "BUSINESS"]),
	vehicleController.registerByPlate,
)
router.get("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.getVehicleById)
router.patch("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.updateVehicle)
router.delete("/:id", authenticate, authorize(["EVDRIVER", "BUSINESS"]), vehicleController.deleteVehicle)


router.get(
	"/lookup/company-by-plate",
	authenticate,
	authorize(["ADMIN", "STAFF", "EVDRIVER", "BUSINESS"]),
	vehicleController.getCompanyByLicensePlate,
)

export { router as vehicleRoutes }
