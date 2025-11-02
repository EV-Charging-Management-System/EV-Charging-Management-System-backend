import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { businessController } from "../controllers/businessController";

const router = Router();

// 🟢 Gửi yêu cầu nâng cấp doanh nghiệp
router.post("/upgrade-request", authenticate, businessController.requestUpgrade);

export { router as businessRoutes };
