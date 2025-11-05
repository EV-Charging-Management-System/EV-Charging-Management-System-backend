import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middlewares/errorMiddleware";
import type { AuthRequest } from "@/middlewares/authMiddleware";
import { buildVnpUrl, verifyVnpReturn } from "../utils/vnpay";
import { NVarChar, Int, Decimal, Date as SqlDate } from "mssql";
import { getDbPool } from "../config/database";

// 🔹 Hàm lấy IP thật của client (có proxy)
const getClientIp = (req: Request): string => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return (req.socket.remoteAddress || "127.0.0.1").replace("::ffff:", "");
};

class VnpayController {
  // 🟢 1️⃣ Tạo URL thanh toán VNPay
  createPaymentUrl = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { subscriptionId, amount, orderInfo } = req.body;
      const userId = req.user?.userId;

      // Now subscriptionId is optional — require only userId and amount
      if (!userId || !amount) {
        res.status(400).json({
          success: false,
          message: "Thiếu thông tin: cần amount và userId.",
        });
        return;
      }

      // Normalize subscriptionId to a number or null
      const subscriptionIdNum: number | null = subscriptionId ? Number(subscriptionId) : null;

      // Keep the TxnRef prefix 'SUB_' so downstream checks still work.
      // When subscriptionId is absent, use 'GEN' as a placeholder.
      const txnRef = `SUB_${subscriptionIdNum ?? "GEN"}_${userId}_${Date.now()}`;
      const info = orderInfo || "Thanh toán gói Premium";

      const pool = await getDbPool();

      // 🧾 Ghi record Subscription trước khi redirect VNPay
      // Allow PackageId to be NULL when subscriptionId wasn't provided
      await pool
        .request()
        .input("UserId", Int, userId)
        .input("PackageId", Int, subscriptionIdNum)
        .input("TxnRef", NVarChar(100), txnRef)
        .input("DepositAmount", Decimal(18, 2), amount)
        .input("SubStatus", NVarChar(50), "PENDING") // ✅ đổi Status → SubStatus
        .input("PaymentMethod", NVarChar(50), "VNPay")
        .input("StartDate", SqlDate, new Date())
        .input("DurationMonth", Int, 1)
        .query(`
          INSERT INTO [Subscription]
          (UserId, PackageId, TxnRef, DepositAmount, SubStatus, PaymentMethod, StartDate, DurationMonth)
          VALUES
            (@UserId, @PackageId, @TxnRef, @DepositAmount, @SubStatus, @PaymentMethod, @StartDate, @DurationMonth)
        `);

      // 🏦 Tạo URL thanh toán
      const vnpUrl = buildVnpUrl({
        amount: Number(amount),
        orderInfo: info,
        txnRef,
        ipAddr: getClientIp(req),
        returnUrl: "http://localhost:5000/api/vnpay/return",
      });

      console.log("🔗 [VNPay] URL Generated:", vnpUrl);

      res.status(200).json({
        success: true,
        data: { vnpUrl, txnRef },
        message: "Tạo URL thanh toán VNPay thành công.",
      });
    } catch (error) {
      next(error);
    }
  });

  // 🟢 2️⃣ Xử lý redirect từ VNPay sau khi thanh toán
  vnpReturn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]));
    const isValid = verifyVnpReturn(query);

    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionStatus = query.vnp_TransactionStatus;
    const amount = query.vnp_Amount ? Number(query.vnp_Amount) / 100 : 0;

    console.log("✅ [VNPay Return] Query:", query);
    console.log("🔐 [VNPay Return] Signature valid:", isValid);

    if (isValid && responseCode === "00" && transactionStatus === "00" && txnRef?.startsWith("SUB_")) {
      try {
        const pool = await getDbPool();

        // 🔍 Cập nhật Subscription tương ứng
        await pool
          .request()
          .input("TxnRef", NVarChar(100), txnRef)
          .query(`
            UPDATE [Subscription]
            SET SubStatus = 'ACTIVE',   -- ✅ đổi Status → SubStatus
              IsDeposited = 1,
              PaymentMethod = 'VNPAY',
              PaymentDate = GETDATE()
            WHERE TxnRef = @TxnRef;

            UPDATE [User]
            SET IsPremium = 1
            WHERE UserId = (
              SELECT TOP 1 UserId FROM [Subscription] WHERE TxnRef = @TxnRef
              );
          `);

        console.log(`✅ [VNPay Return] Cập nhật thành công cho TxnRef = ${txnRef}`);
      } catch (err) {
        console.error("⚠️ Lỗi cập nhật Subscription:", err);
      }

      res.redirect(
        `http://localhost:3000/vnpay-return?vnp_ResponseCode=${responseCode}&vnp_TransactionStatus=${transactionStatus}&vnp_TxnRef=${txnRef}&vnp_Amount=${amount}`
      );
      return;
    }

    // ❌ Thanh toán thất bại
    res.redirect(
      `http://localhost:3000/vnpay-return?vnp_ResponseCode=${responseCode || "XX"}&vnp_TransactionStatus=${transactionStatus || "XX"}`
    );
  });

  // 🟢 3️⃣ VNPay IPN callback (xác nhận từ hệ thống VNPay)
  vnpIpn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]));
    const isValid = verifyVnpReturn(query);
    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionStatus = query.vnp_TransactionStatus;

    console.log("🔁 [VNPay IPN] Received:", query);

    try {
      const pool = await getDbPool();

      if (isValid && responseCode === "00" && transactionStatus === "00" && txnRef?.startsWith("SUB_")) {
        await pool
          .request()
          .input("TxnRef", NVarChar(100), txnRef)
          .query(`
            UPDATE [Subscription]
            SET SubStatus = 'ACTIVE',   -- ✅ đổi Status → SubStatus
              IsDeposited = 1,
              PaymentMethod = 'VNPAY',
              PaymentDate = GETDATE()
            WHERE TxnRef = @TxnRef;

            UPDATE [User]
            SET IsPremium = 1
            WHERE UserId = (
              SELECT TOP 1 UserId FROM [Subscription] WHERE TxnRef = @TxnRef
              );
          `);

        console.log(`✅ VNPay IPN xác nhận ${txnRef} → ACTIVE + Premium.`);
      } else {
        await pool.request().input("TxnRef", NVarChar(100), txnRef).query(`
          UPDATE [Subscription]
          SET SubStatus = 'FAILED'   -- ✅ đổi Status → SubStatus
          WHERE TxnRef = @TxnRef;
        `);
        console.log(`❌ VNPay IPN xác nhận ${txnRef} → FAILED`);
      }

      res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
    } catch (error) {
      console.error("VNPay IPN Error:", error);
      res.status(200).json({ RspCode: "99", Message: "Unknown error" });
    }
  });
}

export const vnpayController = new VnpayController();
