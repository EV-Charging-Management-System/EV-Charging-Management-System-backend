import { Router } from "express";
import { discountController } from "../controllers/discountController";
import { authenticate, authorize } from "../middlewares/authMiddleware";

const router = Router();

// Admin/Staff only
router.get("/", authenticate, authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]), discountController.getConfig);
router.get("/premium", authenticate, authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]), discountController.getPremium);
router.patch("/premium", authenticate, authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]), discountController.updatePremium);

export { router as discountRoutes };
