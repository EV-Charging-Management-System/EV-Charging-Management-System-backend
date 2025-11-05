<<<<<<< Updated upstream
import { Router } from "express"
import { vnpayController } from "../controllers/vnpayController"
import { authenticate, authorize } from "../middlewares/authMiddleware"

const router = Router()

// Create VNPAY payment URL (requires auth; allow all roles)
router.post("/create",authenticate,authorize(["ADMIN", "STAFF", "EVDRIVER", "BUSINESS"]), vnpayController.createPaymentUrl)

// VNPAY Return & IPN (public endpoints called by VNPAY)
router.get("/return", vnpayController.vnpReturn)
router.get("/ipn", vnpayController.vnpIpn)

export { router as vnpayRoutes }
=======
import { Router } from "express";
import { vnpayController } from "../controllers/vnpayController";
import { authenticate, authorize } from "../middlewares/authMiddleware";

const router = Router();

/**
 * 🟢 1️⃣ Tạo link thanh toán VNPay
 * (Cần đăng nhập, cho phép tất cả các role)
 */
router.post(
  "/create",
  authenticate,
  authorize(["ADMIN", "STAFF", "EVDRIVER", "BUSINESS"]),
  vnpayController.createPaymentUrl
);

/**
 * 🟢 2️⃣ VNPay Return URL
 * (VNPay redirect về URL này sau khi người dùng thanh toán xong)
 * 👉 Backend xử lý, cập nhật DB, rồi redirect FE tới /payment-success hoặc /payment-fail
 */
router.get("/return", vnpayController.vnpReturn);

/**
 * 🟢 3️⃣ VNPay IPN URL
 * (VNPay gọi về server này để xác nhận thanh toán hợp lệ)
 * 👉 Backend xử lý, cập nhật Subscription.Status = 'ACTIVE' nếu thanh toán thành công
 */
router.get("/ipn", vnpayController.vnpIpn);

export { router as vnpayRoutes };
>>>>>>> Stashed changes
