import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { bookingService } from "../services/bookingService"
import { getDbPool } from "../config/database"
import { buildVnpUrl } from "../utils/vnpay"
import { Request } from "express"

export class BookingController {
  async createBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
  const { stationId, pointId, portId, vehicleId, startTime, depositAmount } = req.body
      const userId = req.user?.userId

      if (!userId || !stationId || !pointId || !portId || !vehicleId || !startTime) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      // Pre-validate foreign keys and relationships to avoid FK constraint errors
      try {
        const pool = await getDbPool()
        const [st, pt, prt, veh] = await Promise.all([
          pool.request().input("StationId", stationId).query(`SELECT 1 AS ok FROM [Station] WHERE StationId = @StationId`),
          pool
            .request()
            .input("PointId", pointId)
            .input("StationId", stationId)
            .query(`SELECT 1 AS ok FROM [ChargingPoint] WHERE PointId = @PointId AND StationId = @StationId`),
          pool
            .request()
            .input("PortId", portId)
            .input("PointId", pointId)
            .query(`SELECT 1 AS ok FROM [ChargingPort] WHERE PortId = @PortId AND PointId = @PointId`),
          pool
            .request()
            .input("VehicleId", vehicleId)
            .input("UserId", userId)
            .query(`SELECT 1 AS ok FROM [Vehicle] WHERE VehicleId = @VehicleId AND UserId = @UserId`),
        ])

        if (st.recordset.length === 0) {
          res.status(400).json({ message: "Invalid stationId" })
          return
        }
        if (pt.recordset.length === 0) {
          res.status(400).json({ message: "Invalid pointId for this station" })
          return
        }
        if (prt.recordset.length === 0) {
          res.status(400).json({ message: "Invalid portId for this point" })
          return
        }
        if (veh.recordset.length === 0) {
          res.status(400).json({ message: "Invalid vehicleId for this user" })
          return
        }
      } catch (preErr) {
        // If validation query fails due to DB issues, bubble up
        throw preErr
      }

      const bookingDate = new Date() // 🕒 tự gán ngày hiện tại

      // Always require a deposit: generate txnRef now and pass to service so it is stored in Payment
      let booking
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
          depositStatus: true,
          txnRef: txnRefPre,
          // if depositAmount is provided, use it; otherwise service will default
          depositAmount: typeof depositAmount === "number" ? depositAmount : undefined,
        })
      

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

  // If we reached here without returning, booking created immediately (shouldn't happen in deposit flow)
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

  res.status(200).json({ success: true, data: booking })
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

  res.status(200).json({ success: true, data: booking })
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

  res.status(200).json({ success: true, data: booking })
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
