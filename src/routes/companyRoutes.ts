import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import {
  getCompanies,
  getCompanyById,
  getCompanyVehicles,
  addVehicleToCompany,
  removeVehicleFromCompany,
  getCompanyHistory,
} from "../controllers/companyController"

const router = Router()

// All company routes require authentication
router.use(authenticate)

// Get all companies (admin only)
router.get("/", authorize(["ADMIN"]), getCompanies)

// Get company by ID
router.get("/:id", getCompanyById)

// Get company vehicles
router.get("/:id/vehicles", getCompanyVehicles)

// Add vehicle to company
router.post("/:id/vehicles", authorize(["BUSINESS", "ADMIN"]), addVehicleToCompany)

// Remove vehicle from company
router.delete("/:id/vehicles/:vehicleId", authorize(["BUSINESS", "ADMIN"]), removeVehicleFromCompany)

// Get company history
router.get("/:id/history", getCompanyHistory)

export default router
