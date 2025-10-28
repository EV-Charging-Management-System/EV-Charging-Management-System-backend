import { getDbPool } from "../config/database"

export class ChargingSessionService {
  async startSession(bookingId: number, vehicleId: number, stationId: number, batteryPercentage: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const checkinTime = new Date()
      const chargingStatus = "ONGOING"

      const result = await pool
        .request()
        .input("BookingId", bookingId)
        .input("VehicleId", vehicleId)
        .input("StationId", stationId)
        .input("CheckinTime", checkinTime)
        .input("ChargingStatus", chargingStatus)
        .input("BatteryPercentage", batteryPercentage)
        .input("Status", 1)
        .query(`
          INSERT INTO [ChargingSession] (BookingId, VehicleId, StationId, CheckinTime, ChargingStatus, BatteryPercentage, Status)
          OUTPUT INSERTED.SessionId
          VALUES (@BookingId, @VehicleId, @StationId, @CheckinTime, @ChargingStatus, @BatteryPercentage, @Status)
        `)

      return { sessionId: result.recordset[0].SessionId, checkinTime, chargingStatus }
    } catch (error) {
      throw new Error("Error starting charging session: " + error)
    }
  }

  async endSession(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const checkoutTime = new Date()

      // Ensure the session belongs to the user via Booking
      const result = await pool
        .request()
        .input("SessionId", sessionId)
        .input("CheckoutTime", checkoutTime)
        .query(`
          UPDATE [ChargingSession]
          SET CheckoutTime = @CheckoutTime, ChargingStatus = 'COMPLETED', Status = 0
          WHERE SessionId = @SessionId
          SELECT * FROM [ChargingSession] WHERE SessionId = @SessionId
        `)

      if (result.recordset.length === 0) {
        throw new Error("Session not found")
      }

      return { message: "Session ended successfully", checkoutTime }
    } catch (error) {
      throw new Error("Error ending charging session: " + error)
    }
  }

  async getSessionDetails(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`
          SELECT cs.*, v.LicensePlate, s.StationName
          FROM [ChargingSession] cs
          JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          JOIN [Station] s ON cs.StationId = s.StationId
          WHERE cs.SessionId = @SessionId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching session details")
    }
  }

  async getUserSessions(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT cs.*, v.LicensePlate, s.StationName
          FROM [ChargingSession] cs
          JOIN [Booking] b ON cs.BookingId = b.BookingId
          JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          JOIN [Station] s ON cs.StationId = s.StationId
          WHERE b.UserId = @UserId
          ORDER BY cs.CheckinTime DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching user sessions")
    }
  }

  async getCompanySessions(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("CompanyId", companyId)
        .query(`
          SELECT cs.*, v.LicensePlate, s.StationName
          FROM [ChargingSession] cs
          JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          JOIN [Station] s ON cs.StationId = s.StationId
          WHERE v.CompanyId = @CompanyId
          ORDER BY cs.CheckinTime DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching company sessions")
    }
  }

  async addPenalty(sessionId: number, penaltyFee: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("SessionId", sessionId)
        .input("PenaltyFee", penaltyFee)
        .query(`
          UPDATE [ChargingSession] SET PenaltyFee = @PenaltyFee WHERE SessionId = @SessionId
        `)
    } catch (error) {
      throw new Error("Error adding penalty")
    }
  }

  async calculateSessionPrice(sessionId: number, discountPercent = 0): Promise<number> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`
          SELECT 
            DATEDIFF(MINUTE, CheckinTime, CheckoutTime) as DurationMinutes,
            PortTypeOfKwh
          FROM [ChargingSession] cs
          JOIN [ChargingPort] cp ON cs.VehicleId = cp.PortId
          WHERE cs.SessionId = @SessionId
        `)

      if (result.recordset.length === 0) return 0

      const { DurationMinutes, PortTypeOfKwh } = result.recordset[0]
      const basePrice = (DurationMinutes / 60) * PortTypeOfKwh * 1000
      const discountedPrice = basePrice * (1 - discountPercent / 100)

      return discountedPrice
    } catch (error) {
      throw new Error("Error calculating session price")
    }
  }
}

export const chargingSessionService = new ChargingSessionService()
