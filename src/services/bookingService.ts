import { getDbPool } from "../config/database"
import { v4 as uuidv4 } from "uuid"

const DEFAULT_DEPOSIT_AMOUNT = 50000 // VND (assumption)

interface CreateBookingParams {
  userId: number
  stationId: number
  vehicleId: number
  pointId: number
  portId: number
  bookingDate?: string | Date
  startTime?: string | Date
  qr?: string
  depositStatus?: boolean
  txnRef?: string
  depositAmount?: number
}


export class BookingService {
  async createBooking(params: CreateBookingParams): Promise<any> {
  const pool = await getDbPool()
  try {
    // If deposit is requested, create a pending booking and a pending payment record.
    if (params.depositStatus) {
      const pendingStatus = "PENDING"
      const qr = params.qr || uuidv4()

      const bookingDate = params.bookingDate ? new Date(params.bookingDate) : new Date()
      const startTime = params.startTime ? new Date(params.startTime) : new Date()

      const bookingResult = await pool
        .request()
        .input("UserId", params.userId)
        .input("StationId", params.stationId)
        .input("PointId", params.pointId)
        .input("PortId", params.portId)
        .input("VehicleId", params.vehicleId)
        .input("BookingDate", bookingDate)
        .input("StartTime", startTime)
        .input("Status", pendingStatus)
        .input("QR", qr)
        .input("DepositStatus", 1)
        .input("DepositAmount", (params.depositAmount as number) || DEFAULT_DEPOSIT_AMOUNT)
        .query(`
          INSERT INTO [Booking] 
            (UserId, StationId, PointId, PortId, VehicleId, BookingDate, StartTime, Status, QR, DepositStatus, DepositAmount)
          OUTPUT INSERTED.BookingId
          VALUES 
            (@UserId, @StationId, @PointId, @PortId, @VehicleId, @BookingDate, @StartTime, @Status, @QR, @DepositStatus, @DepositAmount)
        `)

      const bookingId = bookingResult.recordset[0].BookingId

      // Create a pending payment record with BookingId and (preliminary) TxnRef if provided
      const depositAmount = (params as any).depositAmount || DEFAULT_DEPOSIT_AMOUNT
      const txnRef = params.txnRef || null

      const paymentResult = await pool
        .request()
        .input("UserId", params.userId)
        .input("BookingId", bookingId)
        .input("InvoiceId", null)
        .input("TotalAmount", depositAmount)
        .input("PaymentTime", new Date())
        .input("PaymentStatus", "Pending")
        .input("SubPayment", 0)
        .input("SessionPayment", depositAmount)
        .input("PaymentType", "VNPAY")
        .input("IsPostPaid", 0)
        .input("IsDeposit", 1)
        .input("TxnRef", txnRef)
        .query(`
          INSERT INTO [Payment] (UserId, BookingId, InvoiceId, TotalAmount, PaymentTime, PaymentStatus, SubPayment, SessionPayment, PaymentType, IsPostPaid, IsDeposit, TxnRef)
          OUTPUT INSERTED.PaymentId
          VALUES (@UserId, @BookingId, @InvoiceId, @TotalAmount, @PaymentTime, @PaymentStatus, @SubPayment, @SessionPayment, @PaymentType, @IsPostPaid, @IsDeposit, @TxnRef)
        `)

      const paymentId = paymentResult.recordset[0].PaymentId

      // Return minimal info: pending booking id and payment id for building vnpUrl.
      // We will embed both paymentId and bookingId in the txnRef (client receives it and uses it for IPN mapping).
      return { pending: true, bookingId, paymentId, depositAmount, txnRef }
    }

    const status = "ACTIVE"
    const qr = params.qr || uuidv4()

    // ✅ Cho phép user nhập BookingDate, nếu không nhập thì lấy hiện tại
    const bookingDate = params.bookingDate ? new Date(params.bookingDate) : new Date()
    const startTime = params.startTime ? new Date(params.startTime) : new Date()

    const result = await pool
      .request()
      .input("UserId", params.userId)
      .input("StationId", params.stationId)
      .input("PointId", params.pointId)
      .input("PortId", params.portId)
      .input("VehicleId", params.vehicleId)
      .input("BookingDate", bookingDate)
      .input("StartTime", startTime)
      .input("Status", status)
      .input("QR", qr)
      .input("DepositStatus", params.depositStatus ? 1 : 0)
      .query(`
        INSERT INTO [Booking] 
          (UserId, StationId, PointId, PortId, VehicleId, BookingDate, StartTime, Status, QR, DepositStatus)
        OUTPUT INSERTED.BookingId
        VALUES 
          (@UserId, @StationId, @PointId, @PortId, @VehicleId, @BookingDate, @StartTime, @Status, @QR, @DepositStatus)
      `)

    return {
      bookingId: result.recordset[0].BookingId,
      qr,
      status,
      message: "Booking created successfully",
    }
  } catch (error) {
    throw new Error("Error creating booking: " + error)
  }
}

  async getBookingByPaymentId(paymentId: number): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const rs = await pool.request().input("PaymentId", paymentId).query(`SELECT * FROM [Payment] WHERE PaymentId = @PaymentId`)
      const payment = rs.recordset[0]
      if (!payment) return null
      const bookingId = payment.BookingId
      if (!bookingId) return null
      return this.getBookingDetails(Number(bookingId))
    } catch (error) {
      throw new Error("Error fetching booking by payment id")
    }
  }


  
  async getUserBookings(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT b.*, v.LicensePlate, v.VehicleName, s.StationName
          FROM [Booking] b
          JOIN [Vehicle] v ON b.VehicleId = v.VehicleId
          JOIN [Station] s ON b.StationId = s.StationId
          WHERE b.UserId = @UserId
          ORDER BY b.BookingDate DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching user bookings")
    }
  }

  async getBookingDetails(bookingId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("BookingId", bookingId)
        .query(`
          SELECT b.*, v.LicensePlate, v.VehicleName, s.StationName
          FROM [Booking] b
          JOIN [Vehicle] v ON b.VehicleId = v.VehicleId
          JOIN [Station] s ON b.StationId = s.StationId
          WHERE b.BookingId = @BookingId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching booking details")
    }
  }

async getBookingByStationId(stationId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("StationId", stationId)
        .query(`
          SELECT b.*, v.LicensePlate, v.VehicleName, s.StationName
          FROM [Booking] b
          JOIN [Vehicle] v ON b.VehicleId = v.VehicleId
          JOIN [Station] s ON b.StationId = s.StationId
          WHERE b.StationId = @StationId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching booking details")
    }
  }

  
  async cancelBooking(bookingId: number, userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("BookingId", bookingId)
        .input("UserId", userId)
        .query(`
          DELETE FROM [Booking] WHERE BookingId = @BookingId AND UserId = @UserId
        `)

      if (result.rowsAffected[0] === 0) {
        throw new Error("Booking not found or unauthorized")
      }

      return { message: "Booking cancelled successfully" }
    } catch (error) {
      throw new Error("Error cancelling booking")
    }
  }

  async getAvailableSlots(stationId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("StationId", stationId)
        .query(`
          SELECT 
            s.*,
            (SELECT COUNT(*) FROM [ChargingPoint] WHERE StationId = @StationId AND ChargingPointStatus = 'AVAILABLE') as AvailablePoints
          FROM [Station] s
          WHERE s.StationId = @StationId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching available slots")
    }
  }

  async checkoutBooking(bookingId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("BookingId", bookingId)
        .query(`
          UPDATE [Booking] SET Status = 'COMPLETED' WHERE BookingId = @BookingId
        `)
    } catch (error) {
      throw new Error("Error checking out booking")
    }
  }
}

export const bookingService = new BookingService()
