import { NVarChar, Int, DateTime } from "mssql"
import { getDbPool } from "../config/database"
interface CreateBookingParams {
  userId: number
  stationId: number
  vehicleId: number
  qr?: string
  depositStatus?: boolean
}


class BookingService {
  async createBooking(params: CreateBookingParams): Promise<any> {
  const pool = await getDbPool()
  try {
    const status = "ACTIVE"
    const bookingDate = new Date()

    await pool
      .request()
      .input("UserId", params.userId)
      .input("StationId", params.stationId)
      .input("VehicleId", params.vehicleId)
      .input("BookingDate", bookingDate)
      .input("Status", status)
      .input("DepositStatus", 0)
      .query(`
        INSERT INTO [Booking] (UserId, StationId, VehicleId, BookingDate, Status, DepositStatus)
        VALUES (@UserId, @StationId, @VehicleId, @BookingDate, @Status, @DepositStatus)
      `)

      await pool
      .request()
      .input("StationId", params.stationId)
      .query(`
UPDATE [Station]
SET ChargingPointTotal = ChargingPointTotal - 1
WHERE StationId = @StationId;
      `)

    return { status, message: "Booking created successfully" }
  } catch (error) {
    throw new Error("Error creating booking: " + error)
  }
}


  async getUserBookings(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT * FROM [Booking] WHERE UserId = @UserId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching user bookings")
    }
  }

  async getBookingDetails(bookingId: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("BookingId", NVarChar, bookingId)
        .query(`
          SELECT * FROM [Booking] WHERE BookingId = @BookingId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching booking details")
    }
  }

  async cancelBooking(bookingId: number, userId: number): Promise<any> {
    const pool = await getDbPool()
try {
  const result = await pool
    .request()
    .input("BookingId", Int, bookingId)
    .query(`
      DELETE FROM [Booking] WHERE BookingId = @BookingId
    `)

  if (result.rowsAffected[0] === 0) {
    throw new Error("Booking not found or unauthorized")
  }

  return { message: "Booking deleted successfully" }
} catch (error) {
  throw new Error("Error deleting booking")
}

  }

  async getAvailableSlots(stationId: string): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("StationId", Number.parseInt(stationId))
        .query(`
          SELECT * FROM Station
          WHERE StationId = @StationId 
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching available slots")
    }
  }
}

export const bookingService = new BookingService()
