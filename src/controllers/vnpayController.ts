import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../middlewares/errorMiddleware"
import type { AuthRequest } from "@/middlewares/authMiddleware"
import { buildVnpUrl, verifyVnpReturn } from "../utils/vnpay"
import { NVarChar, Date as SqlDate, Decimal, Int } from "mssql"
import { getDbPool } from "../config/database"
import { subscriptionService } from "../services/subscriptionService"

const getClientIp = (req: Request): string => {
  // X-Forwarded-For may contain a list of IPs. Take the first one.
  const xff = (req.headers["x-forwarded-for"] as string) || ""
  if (xff) return xff.split(",")[0].trim()
  // req.ip may include IPv6 prefix ::ffff:
  return (req.ip || "127.0.0.1").replace("::ffff:", "")
}

class VnpayController {
  // Create a VNPAY payment URL (no DB insert yet)
  createPaymentUrl = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, invoiceId, packageId, amount, orderInfo } = req.body as {
        sessionId?: number
        invoiceId?: number
        packageId?: number
        amount: number
        orderInfo?: string
      }
      const userId = req.user?.userId
      if (!userId || !amount || (!sessionId && !invoiceId && !packageId)) {
        res.status(400).json({ message: "Missing required fields (need amount and one of sessionId, invoiceId or packageId)" })
        return
      }

      const targetPrefix = sessionId ? `S_${sessionId}` : invoiceId ? `I_${invoiceId}` : `P_${packageId}`
      const txnRef = `${targetPrefix}_${userId}_${Date.now()}`
      const info = orderInfo || (sessionId ? `Thanh toan phien sac ${sessionId}` : invoiceId ? `Thanh toan hoa don ${invoiceId}` : `Thanh toan goi ${packageId}`)

      const url = buildVnpUrl({ amount, orderInfo: info, txnRef, ipAddr: getClientIp(req) })
      res.status(200).json({ data: { url, txnRef }, message: "VNPAY URL created" })
    } catch (error) {
      next(error)
    }
  })

  // VNPAY client return URL (user redirect)
  vnpReturn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]))
    const isValid = verifyVnpReturn(query)
    const txnRef = query.vnp_TxnRef
    const responseCode = query.vnp_ResponseCode
    const transactionStatus = query.vnp_TransactionStatus
    // Build a convenient IPN test URL from the exact same query (local/dev helper)
    const originalUrl = req.originalUrl || ""
    const qIndex = originalUrl.indexOf("?")
    const rawQuery = qIndex >= 0 ? originalUrl.slice(qIndex + 1) : ""
    const ipnTestUrl = `${req.protocol}://${req.get("host")}/api/vnpay/ipn${rawQuery ? "?" + rawQuery : ""}`

    // Do not update DB here; rely on IPN for final status. Just inform client.
    // If preview=true is passed, render a minimal HTML page with a clickable IPN link (useful for manual testing)
    if (String(req.query.preview) === "true") {
      res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VNPAY Return</title>
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial;max-width:720px;margin:40px auto;padding:0 16px} .ok{color:#067d2e} .warn{color:#b36b00} .box{padding:16px;border:1px solid #ddd;border-radius:8px;margin-top:16px}</style>
  </head>
  <body>
    <h2>VNPAY Return</h2>
    <div class="box">
      <div>Status verify: ${isValid ? '<span class="ok">valid</span>' : '<span class="warn">invalid</span>'}</div>
      <div>TxnRef: ${txnRef || "(none)"}</div>
      <div>vnp_ResponseCode: ${responseCode || "(undefined)"}</div>
      <div>vnp_TransactionStatus: ${transactionStatus || "(undefined)"}</div>
    </div>
    <div class="box">
      <p>IPN test URL (manual trigger for local dev):</p>
      <p><a href="${ipnTestUrl}">${ipnTestUrl}</a></p>
      <p><small>Note: In production, IPN is called server-to-server by VNPAY. This link is for local testing convenience.</small></p>
    </div>
  </body>
</html>`)
      return
    }

    res.status(200).json({
      success: isValid && responseCode === "00" && transactionStatus === "00",
      message: isValid ? "VNPAY return processed" : "Invalid signature",
      data: { txnRef, responseCode, transactionStatus, ipnTestUrl },
    })
  })

  // VNPAY IPN (server-to-server). Update DB status here.
  vnpIpn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]))
    const isValid = verifyVnpReturn(query)

    if (!isValid) {
      res.status(200).json({ RspCode: "97", Message: "Invalid signature" })
      return
    }

    const txnRef = query.vnp_TxnRef
    const responseCode = query.vnp_ResponseCode // 00 = success
    const transactionStatus = query.vnp_TransactionStatus // 00 = success

    const pool = await getDbPool()

    try {
      if (responseCode === "00" && transactionStatus === "00") {
        // Parse txnRef: S_{sessionId}_{userId}_{ts} or I_{invoiceId}_{userId}_{ts}
        let sessionId: number | null = null
        let invoiceId: number | null = null
        let userId: number | null = null

        const parts = (txnRef || "").split("_")
        if (parts.length >= 3) {
          if (parts[0] === "S") {
            sessionId = Number(parts[1]) || null
          } else if (parts[0] === "I") {
            invoiceId = Number(parts[1]) || null
          }
          userId = Number(parts[2]) || null
        }

        const amountVnd = Number(query.vnp_Amount || 0) / 100 // vnp_Amount is in cents

        // If userId is unknown, try resolve via session/invoice
        if (!userId && sessionId) {
          const rs = await pool.request().input("SessionId", Int, sessionId).query(`
            SELECT b.UserId
            FROM [ChargingSession] s
            JOIN [Booking] b ON b.BookingId = s.BookingId
            WHERE s.SessionId = @SessionId
          `)
          userId = rs.recordset[0]?.UserId || null
        }
        if (!userId && invoiceId) {
          const rs = await pool.request().input("InvoiceId", Int, invoiceId).query(`
            SELECT i.UserId FROM [Invoice] i WHERE i.InvoiceId = @InvoiceId
          `)
          userId = rs.recordset[0]?.UserId || null
        }

        // If txnRef indicates a booking deposit (format: B_{paymentId}_{bookingId}_{userId}_{ts})
        if (txnRef && txnRef.startsWith("B_")) {
          const partsB = txnRef.split("_")
          let paymentId: number | null = Number(partsB[1]) || null
          let bookingId: number | null = Number(partsB[2]) || null

          // Fallback: if paymentId/bookingId not parsed, try map by TxnRef in Payment table
          if (!paymentId || !bookingId) {
            try {
              const mapRs = await pool
                .request()
                .input("TxnRef", NVarChar, txnRef)
                .query(`SELECT TOP 1 PaymentId, BookingId FROM [Payment] WHERE TxnRef = @TxnRef`)
              const row = mapRs.recordset[0]
              paymentId = paymentId || row?.PaymentId || null
              bookingId = bookingId || row?.BookingId || null
            } catch (mapErr) {
              console.error("IPN: Fallback map by TxnRef failed:", mapErr)
            }
          }

          // Idempotency: if payment already Paid, just ensure booking ACTIVE and acknowledge
          if (paymentId) {
            const payCheck = await pool
              .request()
              .input("PaymentId", Int, paymentId)
              .query(`SELECT PaymentStatus, BookingId FROM [Payment] WHERE PaymentId = @PaymentId`)
            const currentPayStatus: string | undefined = payCheck.recordset[0]?.PaymentStatus
            const currentLinkedBookingId: number | undefined = payCheck.recordset[0]?.BookingId

            // If DB payment row is missing BookingId but we parsed one, link it for consistency
            if (!currentLinkedBookingId && bookingId) {
              try {
                await pool
                  .request()
                  .input("PaymentId", Int, paymentId)
                  .input("BookingId", Int, bookingId)
                  .query(`UPDATE [Payment] SET BookingId = @BookingId WHERE PaymentId = @PaymentId`)
              } catch (linkErr) {
                console.warn("IPN: Failed to backfill Payment.BookingId:", linkErr)
              }
            }

            if (currentPayStatus === "Paid") {
              if (bookingId) {
                const bk = await pool.request().input("BookingId", Int, bookingId).query(`SELECT Status FROM [Booking] WHERE BookingId = @BookingId`)
                const currentBkStatus: string | undefined = bk.recordset[0]?.Status
                if (currentBkStatus !== "ACTIVE") {
                  await pool.request().input("BookingId", Int, bookingId).query(`UPDATE [Booking] SET Status = 'ACTIVE', DepositPaid = 1 WHERE BookingId = @BookingId`)
                }
              }
              res.status(200).json({ RspCode: "00", Message: "Confirm Success (idempotent)" })
              return
            }

            // Update existing pending payment to Paid by PaymentId parsed from txnRef.
            await pool
              .request()
              .input("PaymentId", Int, paymentId)
              .input("TotalAmount", Decimal, amountVnd)
              .input("PaymentTime", SqlDate, new Date())
              .input("PaymentStatus", NVarChar, "Paid")
              .query(`
                UPDATE [Payment]
                SET TotalAmount = @TotalAmount, PaymentTime = @PaymentTime, PaymentStatus = @PaymentStatus
                WHERE PaymentId = @PaymentId
              `)
          } else {
            // Can't map to an existing payment without DB changes; log and continue
            console.error("IPN: txnRef indicates booking deposit but paymentId missing in txnRef:", txnRef)
          }

          // Activate the pending booking
          if (bookingId) {
            const bk = await pool.request().input("BookingId", Int, bookingId).query(`SELECT Status FROM [Booking] WHERE BookingId = @BookingId`)
            const currentBkStatus: string | undefined = bk.recordset[0]?.Status
            if (currentBkStatus !== "ACTIVE") {
              await pool.request().input("BookingId", Int, bookingId).query(`UPDATE [Booking] SET Status = 'ACTIVE', DepositPaid = 1 WHERE BookingId = @BookingId`)
            }
          }
        } else {
          // Insert payment as Paid for other types (sessions, invoices, packages)
          await pool
            .request()
            .input("UserId", Int, userId)
            .input("SessionId", Int, sessionId)
            .input("InvoiceId", Int, invoiceId)
            .input("TotalAmount", Decimal, amountVnd)
            .input("PaymentTime", SqlDate, new Date())
            .input("PaymentStatus", NVarChar, "Paid")
            .input("SubPayment", Decimal, invoiceId ? amountVnd : 0)
            .input("SessionPayment", Decimal, sessionId ? amountVnd : 0)
            .input("PaymentType", NVarChar, "VNPAY")
            .input("IsPostPaid", Int, 0)
            .query(`
              INSERT INTO [Payment] (UserId, SessionId, InvoiceId, TotalAmount, PaymentTime, PaymentStatus, SubPayment, SessionPayment, PaymentType, IsPostPaid)
              VALUES (@UserId, @SessionId, @InvoiceId, @TotalAmount, @PaymentTime, @PaymentStatus, @SubPayment, @SessionPayment, @PaymentType, @IsPostPaid)
            `)

          // If invoice was paid, mark invoice as Paid
          if (invoiceId) {
            await pool.request().input("InvoiceId", Int, invoiceId).query(`UPDATE [Invoice] SET PaidStatus = 'Paid' WHERE InvoiceId = @InvoiceId`)
          }

          // If this was a package purchase (txnRef starting with P_), create the subscription for the user
          // txnRef expected format for package: P_{packageId}_{userId}_{ts}
          if (txnRef && txnRef.startsWith("P_")) {
            try {
              const partsP = txnRef.split("_")
              const pkgId = Number(partsP[1]) || null
              const uId = Number(partsP[2]) || userId
              if (pkgId && uId) {
                // default duration: 1 month (this can be extended to encode duration in txnRef)
                await subscriptionService.buyForUser(Number(uId), Number(pkgId), 1, null)
              }
            } catch (errPkg) {
              // log but do not fail the IPN ack
              console.error("Failed to create subscription from VNPAY IPN:", errPkg)
            }
          }
        }

        res.status(200).json({ RspCode: "00", Message: "Confirm Success" })
      } else {
        // Per VNPAY spec, still acknowledge with 00 so they stop retrying,
        // but make it explicit that no DB state change is performed.
        res.status(200).json({
          RspCode: "00",
          Message: "Received (no update) - vnp_ResponseCode=" + String(responseCode) + ", vnp_TransactionStatus=" + String(transactionStatus),
        })
      }
    } catch (e) {
      res.status(200).json({ RspCode: "99", Message: "Unknown error" })
    }
  })
}

export const vnpayController = new VnpayController()
