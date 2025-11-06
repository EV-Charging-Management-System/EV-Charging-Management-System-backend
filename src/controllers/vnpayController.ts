import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middlewares/errorMiddleware";
import type { AuthRequest } from "@/middlewares/authMiddleware";
import { buildVnpUrl, verifyVnpReturn } from "../utils/vnpay";
import { Int, NVarChar, Date as SqlDate } from "mssql";
import { getDbPool } from "../config/database";

// 🔹 Hàm lấy IP thật của client (có proxy) + chuẩn hóa IPv6 loopback về IPv4
const getClientIp = (req: Request): string => {
  const xff = req.headers["x-forwarded-for"];
  let ip = typeof xff === "string" && xff.length > 0 ? xff.split(",")[0].trim() : (req.socket.remoteAddress || "127.0.0.1");
  ip = ip.replace("::ffff:", "");
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") ip = "127.0.0.1";
  return ip;
};

class VnpayController {
  // 🟢 1️⃣ Tạo URL thanh toán VNPay
  createPaymentUrl = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {

  const { userId: bodyUserId, amount, orderInfo, subscriptionId: rawSubId } = req.body;
        const userId = (bodyUserId !== undefined && !isNaN(Number(bodyUserId))) ? Number(bodyUserId) : req.user?.userId;
  const packageIdFromFe = rawSubId !== undefined && !isNaN(Number(rawSubId)) ? Number(rawSubId) : undefined;

      // Now subscriptionId is optional — require only userId and amount
      if (!userId || !amount) {
        res.status(400).json({
          success: false,
          message: "Thiếu thông tin: cần amount và userId.",
        });
        return;
      }

  // Nếu là flow subscription (có packageId) → dùng premium text; ngược lại mặc định là đặt cọc
  const info = orderInfo || (packageIdFromFe !== undefined ? "Thanh toán gói Premium" : "Đặt cọc");

      const pool = await getDbPool();

      // Determine txnRef: if FE provided a `subscriptionId` (treated as PackageId), create a Subscription row and use SUB_ flow; otherwise PAY_
      let txnRef: string;
      if (packageIdFromFe !== undefined) {
        // Validate Package exists (optional price check can be added)
        const pkg = await pool
          .request()
          .input("PackageId", Int, packageIdFromFe)
          .query(`SELECT TOP 1 PackageId FROM [Package] WHERE PackageId = @PackageId`);
        if (!pkg.recordset[0]) {
          res.status(400).json({ success: false, message: "Package không tồn tại." });
          return;
        }

        // Fetch CompanyId from user (nullable depending on schema)
        const userRow = await pool
          .request()
          .input("UserId", Int, userId)
          .query(`SELECT UserId, UserName, Mail, CompanyId FROM [User] WHERE UserId = @UserId`);
        let companyId: number | null = userRow.recordset[0]?.CompanyId ?? null;

        // CompanyId is required (NOT NULL) on Subscription. If user has no company, create a personal company and assign it.
        if (companyId === null || companyId === undefined) {
          const displayName = userRow.recordset[0]?.UserName || `User-${userId}`;
          const newCompany = await pool
            .request()
            .input("CompanyName", NVarChar(100), `Personal - ${displayName}`)
            .query(`
              INSERT INTO [Company] (CompanyName)
                OUTPUT INSERTED.CompanyId
              VALUES (@CompanyName)
            `);
          const newCompanyId: number | undefined = newCompany.recordset[0]?.CompanyId;
          if (!newCompanyId) {
            res.status(500).json({ success: false, message: "Không thể tạo Company mặc định cho người dùng." });
            return;
          }
          // Update user to link this new company
          await pool
            .request()
            .input("UserId", Int, userId)
            .input("CompanyId", Int, newCompanyId)
            .query(`UPDATE [User] SET CompanyId = @CompanyId WHERE UserId = @UserId`);
          companyId = newCompanyId;
        }

        // Create a PENDING subscription for this Package
        const startDate = new Date();
        const startMonth = `${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
        const durationMonth = "1";

        const insertResult = await pool
          .request()
          .input("UserId", Int, userId)
          .input("CompanyId", Int, companyId)
          .input("PackageId", Int, packageIdFromFe)
          .input("StartMonth", NVarChar(100), startMonth)
          .input("StartDate", SqlDate, startDate)
          .input("DurationMonth", NVarChar(100), durationMonth)
          .input("SubStatus", NVarChar(20), "PENDING")
          .query(`
            INSERT INTO [Subscription]
            (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth, SubStatus)
              OUTPUT INSERTED.SubscriptionId
            VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth, @SubStatus)
          `);

        const createdSubId: number | undefined = insertResult.recordset[0]?.SubscriptionId;
        if (!createdSubId) {
          res.status(500).json({ success: false, message: "Không thể tạo Subscription" });
          return;
        }

        txnRef = `SUB_${createdSubId}_${userId}_${Date.now()}`;
      } else {
        // No subscriptionId provided → treat as generic payment (no premium activation)
        txnRef = `PAY_${userId}_${Date.now()}`;
      }

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
        data: { url: vnpUrl, vnpUrl, txnRef },
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

    // On success: only activate subscription when txnRef has SUB_ prefix; ignore PAY_ for premium
    try {
      if (isValid && responseCode === "00" && transactionStatus === "00" && txnRef) {
        const pool = await getDbPool();

        if (txnRef.startsWith("SUB_")) {
          // Case A: Pre-created subscription → set ACTIVE
          const parts = txnRef.split("_");
          const subIdPart = parts.length >= 3 ? parts[1] : undefined;
          const subId = subIdPart ? Number(subIdPart) : NaN;
          if (!isNaN(subId)) {
            await pool
              .request()
              .input("SubscriptionId", Int, subId)
              .query(`UPDATE [Subscription] SET SubStatus = 'ACTIVE' WHERE SubscriptionId = @SubscriptionId`);
            console.log(`✅ [VNPay Return] Subscription ${subId} set to ACTIVE`);
            // Also mark user as premium (IsPremium = 1) now that subscription is active
            await pool
              .request()
              .input("SubscriptionId", Int, subId)
              .query(`
                UPDATE u
                SET u.IsPremium = 1
                FROM [User] u
                INNER JOIN [Subscription] s ON s.UserId = u.UserId
                WHERE s.SubscriptionId = @SubscriptionId
              `);
          }
        } else if (txnRef.startsWith("PAY_")) {
          // Generic payment: no premium upgrade here
          console.log("ℹ️ [VNPay Return] PAY_ flow: no subscription activation without subscriptionId.");
        }
      }
    } catch (e) {
      console.error("⚠️ [VNPay Return] Failed to update Subscription status:", e);
    }

    const redirectUrl = `http://localhost:3000/vnpay-return?vnp_ResponseCode=${responseCode}&vnp_TransactionStatus=${transactionStatus}&vnp_TxnRef=${txnRef}&vnp_Amount=${amount}`;
    res.redirect(redirectUrl);
  });

  // 🟢 3️⃣ VNPay IPN callback (server-to-server confirmation)
  vnpIpn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]));
    const isValid = verifyVnpReturn(query);
    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionStatus = query.vnp_TransactionStatus;

    console.log("🔁 [VNPay IPN] Received:", query);

    // Parse SubscriptionId from TxnRef pattern: SUB_{subId}_{userId}_{timestamp}
    let subId: number | null = null;
    if (txnRef && txnRef.startsWith("SUB_")) {
      const parts = txnRef.split("_");
      if (parts.length >= 3) {
        const parsed = Number(parts[1]);
        if (!isNaN(parsed)) subId = parsed;
      }
    }

    try {
      if (isValid && responseCode === "00" && transactionStatus === "00" && subId) {
        const pool = await getDbPool();
        await pool
          .request()
          .input("SubscriptionId", Int, subId)
          .query(`UPDATE [Subscription] SET SubStatus = 'ACTIVE' WHERE SubscriptionId = @SubscriptionId`);
        console.log(`✅ [VNPay IPN] Subscription ${subId} set to ACTIVE`);
        // Also set user premium flag
        await pool
          .request()
          .input("SubscriptionId", Int, subId)
          .query(`
            UPDATE u
            SET u.IsPremium = 1
            FROM [User] u
            INNER JOIN [Subscription] s ON s.UserId = u.UserId
            WHERE s.SubscriptionId = @SubscriptionId
          `);
        res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
      } else if (isValid && (!subId) && txnRef && txnRef.startsWith("PAY_") && responseCode === "00" && transactionStatus === "00") {
        // Generic PAY_ success: acknowledge only, no subscription creation or premium upgrade
        console.log("ℹ️ [VNPay IPN] PAY_ flow success: no subscription activation without subscriptionId.");
        res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
      } else if (isValid && subId) {
        const pool = await getDbPool();
        await pool
          .request()
          .input("SubscriptionId", Int, subId)
          .query(`UPDATE [Subscription] SET SubStatus = 'FAILED' WHERE SubscriptionId = @SubscriptionId`);
        console.log(`❌ [VNPay IPN] Subscription ${subId} set to FAILED`);
        res.status(200).json({ RspCode: "00", Message: "Confirm Received" });
      } else if (isValid) {
        console.log("⚠️ [VNPay IPN] Valid signature but cannot parse SubscriptionId from txnRef:", txnRef);
        res.status(200).json({ RspCode: "00", Message: "Confirm Received" });
      } else {
        console.log(`❌ VNPay IPN invalid signature for ${txnRef}`);
        res.status(200).json({ RspCode: "97", Message: "Invalid Checksum" });
      }
    } catch (err) {
      console.error("VNPay IPN processing error:", err);
      res.status(200).json({ RspCode: "99", Message: "Processing error" });
    }
  });
}

export const vnpayController = new VnpayController();
