import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authMiddleware";
import { subscriptionController } from "../controllers/subscriptionController";

const router = Router();

/**
<<<<<<< Updated upstream
 * Subscription Routes — Quản lý gói Premium
 */

// Lấy gói hiện tại của user đang đăng nhập
router.get("/current", authenticate, authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]), subscriptionController.getCurrentUserSubscription);

//  Lấy danh sách toàn bộ subscription (Admin/Staff)
router.get("/", authenticate, authorize(["ADMIN", "BUSINESS", "STAFF"]), subscriptionController.getAll);

//  Lấy chi tiết subscription theo ID
router.get("/:id", authenticate, authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]), subscriptionController.getById);

//  User tự tạo subscription (mua gói)
router.post("/", authenticate, subscriptionController.create);

// Cập nhật subscription (Admin/Staff)
router.put("/:id", authenticate, authorize(["ADMIN", "STAFF"]), subscriptionController.update);
//  Xóa subscription (Admin/Staff)
router.delete("/:id", authenticate, authorize(["ADMIN", "STAFF"]), subscriptionController.delete);
=======
 * 🟢 Subscription Routes — Quản lý gói Premium
 */

// 🧩 1️⃣ Lấy gói hiện tại của user đang đăng nhập
router.get(
  "/current",
  authenticate,
  authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]),
  subscriptionController.getCurrentUserSubscription
);

// 🧩 2️⃣ Lấy danh sách toàn bộ subscription (Admin/Staff)
router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "BUSINESS", "STAFF"]),
  subscriptionController.getAll
);

// 🧩 3️⃣ Lấy chi tiết subscription theo ID
router.get(
  "/:id",
  authenticate,
  authorize(["ADMIN", "BUSINESS", "STAFF", "EVDRIVER"]),
  subscriptionController.getById
);

// 🧩 4️⃣ User tự tạo subscription (mua gói)
router.post("/", authenticate, subscriptionController.create);

// 🧩 5️⃣ Cập nhật subscription (Admin/Staff)
router.put(
  "/:id",
  authenticate,
  authorize(["ADMIN", "STAFF"]),
  subscriptionController.update
);

// 🧩 6️⃣ Xóa subscription (Admin/Staff)
router.delete(
  "/:id",
  authenticate,
  authorize(["ADMIN", "STAFF"]),
  subscriptionController.delete
);
>>>>>>> Stashed changes

export { router as subscriptionRoutes };
