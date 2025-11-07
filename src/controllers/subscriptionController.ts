import type { AuthRequest } from "@/middlewares/authMiddleware";
import { asyncHandler, createError } from "../middlewares/errorMiddleware";
import { subscriptionService } from "../services/subscriptionService";
import { buildVnpUrl } from "../utils/vnpay";
import type { NextFunction, Response } from "express";
import { getDbPool } from "../config/database";
import { Int } from "mssql";

class SubscriptionController {
  // 🟢 1️⃣ Lấy tất cả gói subscription (Admin/Staff)
  getAll = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const subs = await subscriptionService.getAllSubscriptions();
    res.status(200).json({
      success: true,
      message: "Subscriptions fetched successfully",
      data: subs,
    });
  });

  // 🟢 2️⃣ Lấy chi tiết theo ID
  getById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw createError("Invalid subscription id", 400, "VALIDATION_ERROR");

    const sub = await subscriptionService.getSubscriptionById(id);
    if (!sub) throw createError(`Subscription with id=${id} not found`, 404, "NOT_FOUND");

    res.status(200).json({
      success: true,
      message: "Subscription fetched successfully",
      data: sub,
    });
  });

  // 🟢 3️⃣ Lấy gói hiện tại của user đang đăng nhập
  getCurrentUserSubscription = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) throw createError("User not authenticated", 401, "UNAUTHORIZED");

    const pool = await getDbPool();
    const result = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT TOP 1 *
        FROM [Subscription]
        WHERE UserId = @UserId
        ORDER BY StartDate DESC, SubscriptionId DESC; -- ✅ tie-break to pick latest row when same StartDate (DATE)
      `);

    const sub = result.recordset[0];
    if (!sub) {
      res.status(200).json({
        success: true,
        message: "User has no active subscription",
        data: null,
      });
      return;
    }

    // 👉 Kiểm tra hết hạn
    const startDate = new Date(sub.StartDate);
    const expireDate = new Date(startDate);
    expireDate.setMonth(startDate.getMonth() + Number(sub.DurationMonth));

    const now = new Date();
    let subStatus = sub.SubStatus;
    if (subStatus === "ACTIVE" && now > expireDate) {
      subStatus = "EXPIRED";

      // 🔄 Nếu đã hết hạn thì update DB
      await pool.request().input("SubscriptionId", Int, sub.SubscriptionId).query(`
        UPDATE [Subscription]
        SET SubStatus = 'EXPIRED'
        WHERE SubscriptionId = @SubscriptionId;
      `);
    }

    res.status(200).json({
      success: true,
      message: "Fetched current user's subscription successfully",
      data: {
        SubscriptionId: sub.SubscriptionId,
        PackageId: sub.PackageId,
        SubStatus: subStatus,
        StartDate: sub.StartDate,
        DurationMonth: sub.DurationMonth,
        ExpireDate: expireDate, 
      },
    });
  });

  // 🟢 4️⃣ Tạo mới gói Premium (user tự đăng ký)
  create = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const { CompanyId = null, PackageId, StartMonth = null, StartDate, DurationMonth = 1 } = req.body;

    if (!userId) throw createError("User not authenticated", 401, "UNAUTHORIZED");
    if (!PackageId) throw createError("PackageId is required", 400, "VALIDATION_ERROR");
    if (!StartDate) throw createError("StartDate is required", 400, "VALIDATION_ERROR");

    // 🧩 1️⃣ Tạo bản ghi trong bảng [Subscription]
    const created = await subscriptionService.createSubscription({
      UserId: userId,
      CompanyId,
      PackageId,
      StartMonth,
      StartDate,
      DurationMonth,
      SubStatus: "PENDING", // ✅ đổi Status → SubStatus
    });

    if (!created?.SubscriptionId) {
      throw createError("Không thể tạo Subscription — kiểm tra subscriptionService.createSubscription()", 500);
    }

  // 🧩 2️⃣ Sinh mã giao dịch + link VNPay
    const txnRef = `SUB_${created.SubscriptionId}_${userId}_${Date.now()}`;
    const orderInfo = `Thanh toán gói Premium #${created.SubscriptionId}`;
    const amount = 299000; // 💰 giá cố định
    const ipAddr = (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1";

    const vnpUrl = buildVnpUrl({
      amount,
      orderInfo,
      txnRef,
      ipAddr: ipAddr.replace("::ffff:", ""),
      
      returnUrl: process.env.VNP_RETURN_API_URL || "http://localhost:5000/api/vnpay/return",
    });

    // 🧩 3️⃣ (Optional) Persist TxnRef/PaymentMethod — skipped due to current DB schema

    // 🧩 4️⃣ Trả kết quả về FE
    res.status(201).json({
      success: true,
      message: "Tạo gói Premium thành công, đang chuyển đến VNPay...",
      data: {
        SubscriptionId: created.SubscriptionId,
        TxnRef: txnRef,
        vnpUrl,
      },
    });
  });

  // 🟢 5️⃣ Cập nhật subscription (Admin/Staff)
  update = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw createError("Invalid subscription id", 400, "VALIDATION_ERROR");

    const updated = await subscriptionService.updateSubscription(id, req.body);
    if (!updated) throw createError(`Subscription ${id} not found`, 404, "NOT_FOUND");

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: updated,
    });
  });

  // 🟢 6️⃣ Xóa subscription (Admin/Staff)
  delete = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw createError("Invalid subscription id", 400, "VALIDATION_ERROR");

    const deleted = await subscriptionService.deleteSubscription(id);
    if (!deleted) throw createError(`Subscription ${id} not found`, 404, "NOT_FOUND");

    res.status(200).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  });
}

export const subscriptionController = new SubscriptionController();
