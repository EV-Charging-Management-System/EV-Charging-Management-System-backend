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
      // ORIGINAL GENERIC/SUBSCRIPTION FLOW ONLY (no invoiceId here)
      const { userId: bodyUserId, amount, orderInfo, subscriptionId: rawSubId } = req.body;
      const userId = (bodyUserId !== undefined && !isNaN(Number(bodyUserId))) ? Number(bodyUserId) : req.user?.userId;
      const packageIdFromFe = rawSubId !== undefined && !isNaN(Number(rawSubId)) ? Number(rawSubId) : undefined;

      if (!userId) {
        res.status(400).json({ success: false, message: "Thiếu userId" });
        return;
      }

      const pool = await getDbPool();
      let finalAmount: number | undefined = amount !== undefined ? Number(amount) : undefined;
      let info: string = orderInfo || "Thanh toán";
      let txnRef: string;

      // Flow A: Subscription
      if (packageIdFromFe !== undefined) {
        const pkg = await pool
          .request()
          .input("PackageId", Int, packageIdFromFe)
          .query(`SELECT TOP 1 PackageId, PackageName, PackagePrice FROM [Package] WHERE PackageId = @PackageId`);
        const pkgRecord = pkg.recordset[0];
        if (!pkgRecord) {
          res.status(400).json({ success: false, message: "Package không tồn tại." });
          return;
        }
        if (finalAmount === undefined) finalAmount = Number(pkgRecord.PackagePrice || 0);
        info = orderInfo || `Thanh toán gói Premium: ${pkgRecord.PackageName}`;

        const userRow = await pool
          .request()
          .input("UserId", Int, userId)
          .query(`SELECT u.CompanyId FROM [User] u WHERE u.UserId = @UserId`);
        let companyId: number | null = userRow.recordset[0]?.CompanyId ?? null;

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
      }
      // Flow B: Generic payment
      else {
        if (finalAmount === undefined) {
          res.status(400).json({ success: false, message: "Thiếu amount cho thanh toán thông thường" });
          return;
        }
        info = orderInfo || "Đặt cọc";
        txnRef = `PAY_${userId}_${Date.now()}`;
      }

      // 🏦 Tạo URL thanh toán
      const vnpUrl = buildVnpUrl({
        amount: Number(finalAmount),
        orderInfo: info,
        txnRef,
        ipAddr: getClientIp(req),
        returnUrl: process.env.VNP_RETURN_API_URL || "http://localhost:5000/api/vnpay/return",
      });

      console.log("🔗 [VNPay] URL Generated:", vnpUrl);

      res.status(200).json({
        success: true,
        data: { url: vnpUrl, vnpUrl, txnRef, amount: finalAmount },
        url: vnpUrl,
        txnRef,
        amount: finalAmount,
        message: "Tạo URL thanh toán VNPay thành công.",
      });
    } catch (error) {
      next(error);
    }
  });

  // 🆕 1b. Create VNPay URL for a specific invoice
  createInvoicePaymentUrl = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId: bodyUserId, invoiceId: rawInvoiceId, orderInfo } = req.body;
      const userId = (bodyUserId !== undefined && !isNaN(Number(bodyUserId))) ? Number(bodyUserId) : req.user?.userId;
      const invoiceId = rawInvoiceId !== undefined && !isNaN(Number(rawInvoiceId)) ? Number(rawInvoiceId) : undefined;

      if (!userId || invoiceId === undefined) {
        res.status(400).json({ success: false, message: "Thiếu userId hoặc invoiceId" });
        return;
      }
      const pool = await getDbPool();
      const inv = await pool
        .request()
        .input("InvoiceId", Int, invoiceId)
        .query(`SELECT TOP 1 InvoiceId, UserId, TotalAmount, PaidStatus FROM [Invoice] WHERE InvoiceId = @InvoiceId`);
      const invRow = inv.recordset[0];
      if (!invRow) {
        res.status(404).json({ success: false, message: "Invoice không tồn tại" });
        return;
      }
      if (Number(invRow.UserId) !== Number(userId)) {
        res.status(403).json({ success: false, message: "Invoice không thuộc user" });
        return;
      }
      if (String(invRow.PaidStatus).toLowerCase() === "paid") {
        res.status(409).json({ success: false, message: "Invoice đã thanh toán" });
        return;
      }

      const amount = Number(invRow.TotalAmount || 0);
      const info = orderInfo || `Thanh toán hóa đơn #${invoiceId}`;
      const txnRef = `INV_${invoiceId}_${userId}_${Date.now()}`;

      const vnpUrl = buildVnpUrl({
        amount,
        orderInfo: info,
        txnRef,
        ipAddr: getClientIp(req),
        returnUrl: process.env.VNP_RETURN_API_URL || "http://localhost:5000/api/vnpay/return",
      });

      res.status(200).json({
        success: true,
        data: { url: vnpUrl, vnpUrl, txnRef, amount },
        url: vnpUrl,
        txnRef,
        amount,
        message: "Tạo URL thanh toán VNPay cho invoice thành công.",
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

    // On success: activate subscription (SUB_), mark invoice paid (INV_), ignore PAY_ for premium
    try {
      // VNPay Return may not always include vnp_TransactionStatus; success is primarily vnp_ResponseCode === '00'
      if (isValid && responseCode === "00" && txnRef) {
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
        } else if (txnRef.startsWith("INV_")) {
          // Case B: Pay specific invoice
          const parts = txnRef.split("_");
          const invoiceIdPart = parts.length >= 3 ? parts[1] : undefined;
          const invoiceId = invoiceIdPart ? Number(invoiceIdPart) : NaN;
          if (!isNaN(invoiceId)) {
            const existing = await pool
              .request()
              .input("InvoiceId", Int, invoiceId)
              .query(`SELECT InvoiceId, PaidStatus FROM [Invoice] WHERE InvoiceId = @InvoiceId`);
            const invRow = existing.recordset[0];
            if (invRow && String(invRow.PaidStatus).toLowerCase() !== "paid") {
              await pool
                .request()
                .input("InvoiceId", Int, invoiceId)
                .query(`UPDATE [Invoice] SET PaidStatus = 'Paid' WHERE InvoiceId = @InvoiceId`);
              console.log(`✅ [VNPay Return] Invoice ${invoiceId} set to Paid`);
            }
          }
        } else if (txnRef.startsWith("PAY_")) {
          // Generic payment: no premium upgrade here
          console.log("ℹ️ [VNPay Return] PAY_ flow: no subscription activation without subscriptionId.");
        }
      }
    } catch (e) {
      console.error("⚠️ [VNPay Return] Failed to update Subscription status:", e);
    }

    // Redirect includes official VNPay params and FE-friendly aliases (code/txnRef)
  // Redirect directly to PaymentSuccess by default so FE doesn't need to forward params
  const feReturn = process.env.VNP_FE_RETURN_URL || "http://localhost:3000/payment-success";
    const redirectUrl = `${feReturn}?` +
      `vnp_ResponseCode=${responseCode ?? ""}` +
      `&vnp_TransactionStatus=${transactionStatus ?? ""}` +
      `&vnp_TxnRef=${txnRef ?? ""}` +
      `&vnp_Amount=${amount}` +
      // aliases for various FE handlers
      `&responseCode=${responseCode ?? ""}` +
      `&transactionStatus=${transactionStatus ?? ""}` +
      `&code=${responseCode ?? ""}` +
      `&txnRef=${txnRef ?? ""}`;
    console.log("🔁 [VNPay Return] Redirecting FE to:", redirectUrl);
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

    // Parse identifiers from TxnRef pattern: SUB_{subId}_{userId}_{ts} | INV_{invoiceId}_{userId}_{ts}
    let subId: number | null = null;
    let invoiceId: number | null = null;
    if (txnRef && txnRef.startsWith("SUB_")) {
      const parts = txnRef.split("_");
      if (parts.length >= 3) {
        const parsed = Number(parts[1]);
        if (!isNaN(parsed)) subId = parsed;
      }
    } else if (txnRef && txnRef.startsWith("INV_")) {
      const parts = txnRef.split("_");
      if (parts.length >= 3) {
        const parsedInv = Number(parts[1]);
        if (!isNaN(parsedInv)) invoiceId = parsedInv;
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
      } else if (isValid && responseCode === "00" && transactionStatus === "00" && invoiceId) {
        // Invoice payment
        const pool = await getDbPool();
        const inv = await pool
          .request()
          .input("InvoiceId", Int, invoiceId)
          .query(`SELECT InvoiceId, PaidStatus FROM [Invoice] WHERE InvoiceId = @InvoiceId`);
        if (inv.recordset[0] && String(inv.recordset[0].PaidStatus).toLowerCase() !== "paid") {
          await pool
            .request()
            .input("InvoiceId", Int, invoiceId)
            .query(`UPDATE [Invoice] SET PaidStatus = 'Paid' WHERE InvoiceId = @InvoiceId`);
          console.log(`✅ [VNPay IPN] Invoice ${invoiceId} set to Paid`);
        }
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
      } else if (isValid && invoiceId) {
        // Failed invoice payment — keep as is
        console.log(`❌ [VNPay IPN] Invoice ${invoiceId} payment failed or not confirmed`);
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
