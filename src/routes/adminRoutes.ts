import { Router } from "express"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { adminController } from "../controllers/adminController"

const router = Router()

router.use(authenticate)
router.use(authorize(["ADMIN"]))

router.get("/dashboard", adminController.getDashboardStats)
router.get("/approvals", adminController.getPendingApprovals)
router.patch("/approvals/:id/approve", adminController.approveBusiness)
router.patch("/approvals/:id/reject", adminController.rejectBusiness)
router.get("/users", adminController.getAllUsers)
router.get("/users/:id", adminController.getUserById)
router.patch("/users/:id/role", adminController.updateUserRole)
router.get("/reports/revenue", adminController.getRevenueReport)
router.get("/reports/usage", adminController.getUsageReport)
router.post("/createstaff", adminController.createStaff)
router.get("/getAllStaff", adminController.getAllStaff)
router.patch('/deleteStation',adminController.deleteStationById)

export { router as adminRoutes }
