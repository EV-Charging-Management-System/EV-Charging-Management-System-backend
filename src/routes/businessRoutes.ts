import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { businessController } from "../controllers/businessController";

const router = Router();

// (removed) Upgrade request route deprecated in favor of create-company

// 🏢 Tạo công ty mới (đợi admin duyệt)
router.post("/create-company", authenticate, businessController.createCompany);

// 🚗 Quản lý xe của doanh nghiệp/người dùng
router.post("/vehicle", authenticate, businessController.addVehicle);
router.delete("/vehicle/:licensePlate", authenticate, businessController.deleteVehicleByPlate);
router.get("/vehicles", authenticate, businessController.getVehicles);

// 💳 Tổng quan thanh toán của doanh nghiệp
router.get("/payments/summary", authenticate, businessController.getPaymentsSummary);

export { router as businessRoutes };
