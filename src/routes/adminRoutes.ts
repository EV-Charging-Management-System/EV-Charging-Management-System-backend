import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authMiddleware";
import { adminController } from "../controllers/adminController";

const router = Router();

router.use(authenticate);
router.use(authorize(["ADMIN"]));

// 📊 Dashboard
router.get("/dashboard", adminController.getDashboardStats);

// 🏢 Duyệt doanh nghiệp
router.get("/approvals", adminController.getPendingBusinessApprovals);
router.patch("/approvals/:id/approve", adminController.approveBusiness);
router.patch("/approvals/:id/reject", adminController.rejectBusiness);

// 👥 Người dùng & staff
router.get("/users", adminController.getAllUsers);
router.get("/users/:id", adminController.getUserById);
router.patch("/users/:id/role", adminController.updateUserRole);
router.post("/createstaff", adminController.createStaff);
router.get("/getAllStaff", adminController.getAllStaff);

// 📈 Báo cáo
router.get("/reports/revenue", adminController.getRevenueReport);
router.get("/reports/usage", adminController.getUsageReport);

export { router as adminRoutes };
