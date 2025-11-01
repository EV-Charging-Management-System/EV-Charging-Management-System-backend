import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../middlewares/errorMiddleware"
import type { AuthRequest } from "@/middlewares/authMiddleware"
import { buildVnpUrl, verifyVnpReturn } from "../utils/vnpay"
import { NVarChar, Date as SqlDate, Decimal, Int } from "mssql"
import { getDbPool } from "../config/database"

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
      const { sessionId, invoiceId, amount, orderInfo } = req.body as {
        sessionId?: number
        invoiceId?: number
        amount: number
        orderInfo?: string
      }
      const userId = req.user?.userId

      if (!userId || !amount || (!sessionId && !invoiceId)) {
        res.status(400).json({ message: "Missing required fields (need amount and either sessionId or invoiceId)" })
        return
      }

      const targetPrefix = sessionId ? `S_${sessionId}` : `I_${invoiceId}`
  const txnRef = `${targetPrefix}_${userId}_${Date.now()}`
      const info = orderInfo || (sessionId ? `Thanh toan phien sac ${sessionId}` : `Thanh toan hoa don ${invoiceId}`)

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

    // Do not update DB here; rely on IPN for final status. Just inform client.
    if (responseCode === '00') {
    // Thanh toán thành công
    return res.redirect(`http://localhost:3000/payment-success?code=${responseCode}`);
  } else {
    // Thanh toán thất bại
    return res.redirect(`http://localhost:3000/payment-fail?code=${responseCode}`);
  }
  })
  //thằng phú mới là thằng bịp m đó
  //đéo có thằng nào mà vnpay return lại để vào res.json đâu
  // chúc em may mắn :3 <3

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

        // Insert payment as Paid
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

        res.status(200).json({ RspCode: "00", Message: "Confirm Success" })
      } else {
        res.status(200).json({ RspCode: "00", Message: "Confirm Success" })
      }
    } catch (e) {
      res.status(200).json({ RspCode: "99", Message: "Unknown error" })
    }
  })
}

export const vnpayController = new VnpayController()
