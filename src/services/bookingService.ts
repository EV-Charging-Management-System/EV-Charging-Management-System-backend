import { getDbPool } from "../config/database"
import { v4 as uuidv4 } from "uuid"

interface CreateBookingParams {
  userId: number
  stationId: number
  vehicleId: number
  pointId?: number
  portId?: number
  startTime?: string | Date
  qr?: string
  depositStatus?: boolean
}

export class BookingService {
  async createBooking(params: CreateBookingParams): Promise<any> {
  const pool = await getDbPool()
  try {
    const status = "ACTIVE"
    const bookingDate = new Date()
    const qr = params.qr || uuidv4()
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
      message: "Booking created successfully"
    }
  } catch (error) {
    throw new Error("Error creating booking: " + error)
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
