import type { AuthRequest } from "@/middlewares/authMiddleware";
import { asyncHandler, createError } from "../middlewares/errorMiddleware";
import { subscriptionService } from "../services/subscriptionService";
import { buildVnpUrl } from "../utils/vnpay";
import type { NextFunction, Response } from "express";
import { getDbPool } from "../config/database";
<<<<<<< Updated upstream
import { Int, DateTime, NVarChar } from "mssql";
=======
import { Int } from "mssql";
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
        FROM [Subcription]
        WHERE UserId = @UserId
        ORDER BY StartDate DESC;
=======
        FROM [Subscription]
        WHERE UserId = @UserId
        ORDER BY PaymentDate DESC;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    let status = sub.Status;
    if (status === "ACTIVE" && now > expireDate) {
      status = "EXPIRED";

      // 🔄 Nếu đã hết hạn thì update DB
      await pool.request().input("SubcriptionId", Int, sub.SubcriptionId).query(`
        UPDATE [Subcription]
        SET Status = 'EXPIRED'
        WHERE SubcriptionId = @SubcriptionId;
=======
    let subStatus = sub.SubStatus; // ✅ đổi Status → SubStatus
    if (subStatus === "ACTIVE" && now > expireDate) {
      subStatus = "EXPIRED";

      // 🔄 Nếu đã hết hạn thì update DB
      await pool.request().input("SubscriptionId", Int, sub.SubscriptionId).query(`
        UPDATE [Subscription]
        SET SubStatus = 'EXPIRED'
        WHERE SubscriptionId = @SubscriptionId;
>>>>>>> Stashed changes
      `);
    }

    res.status(200).json({
      success: true,
      message: "Fetched current user's subscription successfully",
      data: {
<<<<<<< Updated upstream
        SubcriptionId: sub.SubcriptionId,
        PackageId: sub.PackageId,
        Status: status,
=======
        SubscriptionId: sub.SubscriptionId,
        PackageId: sub.PackageId,
        SubStatus: subStatus, // ✅ dùng SubStatus
>>>>>>> Stashed changes
        PaymentMethod: sub.PaymentMethod,
        TxnRef: sub.TxnRef,
        StartDate: sub.StartDate,
        PaymentDate: sub.PaymentDate,
        DurationMonth: sub.DurationMonth,
        DepositAmount: sub.DepositAmount,
        IsDeposited: sub.IsDeposited,
        ExpireDate: expireDate, // 👈 thêm ngày hết hạn cho FE
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

<<<<<<< Updated upstream
    // 🧩 1️⃣ Tạo bản ghi trong bảng [Subcription]
=======
    // 🧩 1️⃣ Tạo bản ghi trong bảng [Subscription]
>>>>>>> Stashed changes
    const created = await subscriptionService.createSubscription({
      UserId: userId,
      CompanyId,
      PackageId,
      StartMonth,
      StartDate,
      DurationMonth,
<<<<<<< Updated upstream
=======
      SubStatus: "PENDING", // ✅ đổi Status → SubStatus
>>>>>>> Stashed changes
    });

    if (!created?.SubscriptionId) {
      throw createError("Không thể tạo Subscription — kiểm tra subscriptionService.createSubscription()", 500);
    }

    // 🧩 2️⃣ Sinh mã giao dịch + link VNPay
<<<<<<< Updated upstream
  const txnRef = `SUB_${created.SubcriptionId}_${userId}_${Date.now()}`;
=======
    const txnRef = `SUB_${created.SubscriptionId}_${userId}_${Date.now()}`;
>>>>>>> Stashed changes
    const orderInfo = `Thanh toán gói Premium #${created.SubscriptionId}`;
    const amount = 299000; // 💰 giá cố định
    const ipAddr = (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1";

    const vnpUrl = buildVnpUrl({
      amount,
      orderInfo,
      txnRef,
      ipAddr: ipAddr.replace("::ffff:", ""),
    });

<<<<<<< Updated upstream
    // 🧩 3️⃣ Cập nhật lại Subcription sau khi có TxnRef (raw SQL vì service hiện tại không cập nhật các cột này)
    const pool = await getDbPool();
    await pool
      .request()
      .input("SubcriptionId", Int, created.SubcriptionId)
      .input("PaymentMethod", NVarChar(50), "VNPAY")
      .input("TxnRef", NVarChar(200), txnRef)
      .input("Status", NVarChar(50), "PENDING")
      .query(`
        UPDATE [Subcription]
        SET PaymentMethod = @PaymentMethod, TxnRef = @TxnRef, Status = @Status
        WHERE SubcriptionId = @SubcriptionId
      `);
=======
    // 🧩 3️⃣ Cập nhật lại Subscription sau khi có TxnRef
    await subscriptionService.updateSubscription(created.SubscriptionId, {
      PaymentMethod: "VNPAY",
      TxnRef: txnRef,
      SubStatus: "PENDING", // ✅ đổi Status → SubStatus
    });
>>>>>>> Stashed changes

    // 🧩 4️⃣ Trả kết quả về FE
    res.status(201).json({
      success: true,
      message: "Tạo gói Premium thành công, đang chuyển đến VNPay...",
      data: {
<<<<<<< Updated upstream
        SubcriptionId: created.SubcriptionId,
=======
        SubscriptionId: created.SubscriptionId,
>>>>>>> Stashed changes
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
