import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { bookingService } from "../services/bookingService"
import { buildVnpUrl } from "../utils/vnpay"
import { Request } from "express"

export class BookingController {
  async createBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
  const { stationId, pointId, portId, vehicleId, startTime, depositStatus, depositAmount } = req.body
      const userId = req.user?.userId

      if (!userId || !stationId || !pointId || !portId || !vehicleId || !startTime || depositStatus === undefined) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const bookingDate = new Date() // 🕒 tự gán ngày hiện tại

      // If deposit requested, generate txnRef now and pass to service so it is stored in Payment
      let booking
      if (depositStatus) {
        // create temporary txnRef; actual format: B_{paymentId}_{bookingId}_{userId}_{ts}
        const txnRefPre = `B_PRE_${userId}_${Date.now()}`
        booking = await bookingService.createBooking({
          userId,
          stationId,
          pointId,
          portId,
          vehicleId,
          bookingDate,
          startTime,
          depositStatus,
          txnRef: txnRefPre,
          depositAmount: typeof depositAmount === "number" ? depositAmount : undefined,
        })
      } else {
        booking = await bookingService.createBooking({
          userId,
          stationId,
          pointId,
          portId,
          vehicleId,
          bookingDate,
          startTime,
          depositStatus,
        })
      }

      // If bookingService returned a pending object, build VNPAY URL and return it (no full booking yet)
      if (booking && (booking as any).pending) {
  const { bookingId, paymentId, depositAmount: amountToPay } = booking as any

        // We created a preliminary txnRef before inserting payment; now build final txnRef including real ids.
        const finalTxnRef = `B_${paymentId}_${bookingId}_${userId}_${Date.now()}`

        // Persist final txnRef to Payment for traceability and idempotency
        try {
          const pool = await (await import("../config/database")).getDbPool()
          await pool
            .request()
            .input("PaymentId", paymentId)
            .input("TxnRef", finalTxnRef)
            .query(`UPDATE [Payment] SET TxnRef = @TxnRef WHERE PaymentId = @PaymentId`)
          // Ensure Booking QR matches txnRef as requested (use txnRef as QR code)
          await pool
            .request()
            .input("BookingId", bookingId)
            .input("QR", finalTxnRef)
            .query(`UPDATE [Booking] SET QR = @QR WHERE BookingId = @BookingId`)
        } catch (err) {
          console.error("Failed to update payment with final txnRef:", err)
        }

        const getClientIp = (r: Request): string => {
          const xff = (r.headers["x-forwarded-for"] as string) || ""
          if (xff) return xff.split(",")[0].trim()
          return (r.ip || "127.0.0.1").replace("::ffff:", "")
        }

  const url = buildVnpUrl({ amount: amountToPay, orderInfo: `Deposit for booking ${bookingId}`, txnRef: finalTxnRef, ipAddr: getClientIp(req) })

        res.status(200).json({ success: true, data: { url, txnRef: finalTxnRef, paymentId }, message: "Redirect user to VNPAY to complete deposit" })
        return
      }

      // Otherwise booking created immediately (no deposit)
      res.status(201).json({ success: true, data: booking })
    } catch (error) {
      next(error)
    }
  }

  async getBookingByTxnRef(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { txnRef } = req.params as { txnRef?: string }
      if (!txnRef) {
        res.status(400).json({ message: "txnRef is required" })
        return
      }

      // expected format: B_{paymentId}_{bookingId}_{userId}_{ts}
      if (!txnRef.startsWith("B_")) {
        res.status(400).json({ message: "Invalid txnRef" })
        return
      }

      const parts = txnRef.split("_")
      const bookingId = Number(parts[2])
      if (!bookingId) {
        res.status(400).json({ message: "Invalid txnRef format" })
        return
      }

      const booking = await bookingService.getBookingDetails(bookingId)
      if (!booking) {
        res.status(404).json({ message: "Booking not found" })
        return
      }

  const data = { ...booking, qrCode: (booking as any).QR ?? (booking as any).qr }
  res.status(200).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }

  async getBookingByPaymentId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.params
      const pid = Number(paymentId)
      if (!pid) {
        res.status(400).json({ message: "Invalid payment id" })
        return
      }

      const booking = await bookingService.getBookingByPaymentId(pid)
      if (!booking) {
        res.status(404).json({
          message:
            "Không tìm thấy booking cho payment này. Nếu bạn theo luồng VNPAY, vui lòng gọi GET /api/booking/txn/:txnRef với txnRef đã nhận khi tạo booking; hoặc kiểm tra Payment.BookingId trong DB."
        })
        return
      }

  const data = { ...booking, qrCode: (booking as any).QR ?? (booking as any).qr }
  res.status(200).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }


  async getUserBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const bookings = await bookingService.getUserBookings(userId)
      res.status(200).json({ success: true, data: bookings })
    } catch (error) {
      next(error)
    }
  }
  async getBookingsByStationId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const bookings = await bookingService.getBookingByStationId(Number.parseInt(id))

    if (!bookings || bookings.length === 0) {
      res.status(404).json({ message: "Không tìm thấy booking cho trạm này" })
      return
    }

    res.status(200).json({ success: true, data: bookings })
  } catch (error) {
    next(error)
  }
}
  async getBookingDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const booking = await bookingService.getBookingDetails(Number(id))

      if (!booking) {
        res.status(404).json({ message: "Booking not found" })
        return
      }

  const data = { ...booking, qrCode: (booking as any).QR ?? (booking as any).qr }
  res.status(200).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }

  async cancelBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user?.userId

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const result = await bookingService.cancelBooking(Number(id), userId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  async getAvailableSlots(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = req.query

      if (!stationId) {
        res.status(400).json({ message: "Station ID is required" })
        return
      }

      const slots = await bookingService.getAvailableSlots(Number(stationId))
      res.status(200).json({ success: true, data: slots })
    } catch (error) {
      next(error)
    }
  }

  async checkoutBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await bookingService.checkoutBooking(Number(id))
      res.json({ success: true, message: "Booking checked out successfully" })
    } catch (error) {
      next(error)
    }
  }
}

export const bookingController = new BookingController()
