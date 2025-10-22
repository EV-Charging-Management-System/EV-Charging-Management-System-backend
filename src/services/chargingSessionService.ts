import { NVarChar, DateTime, Int } from "mssql"
import { getDbPool } from "../config/database"

class ChargingSessionService {
  async startSession(bookingId: number, userId: number, qrCode: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const sessionId = `SESSION_${Date.now()}`
      const startTime = new Date()

      const result = await pool
        .request()
        .input("SessionId", NVarChar, sessionId)
        .input("BookingId", Int, bookingId)
        .input("UserId", Int, userId)
        .input("QRCode", NVarChar, qrCode)
        .input("StartTime", DateTime, startTime)
        .input("Status", NVarChar, "ACTIVE")
        .query(`
          INSERT INTO [ChargingSession] (SessionId, BookingId, UserId, QRCode, StartTime, Status)
          VALUES (@SessionId, @BookingId, @UserId, @QRCode, @StartTime, @Status)
        `)

      return { sessionId, startTime, status: "ACTIVE" }
    } catch (error) {
      throw new Error("Error starting charging session")
    }
  }

  async endSession(sessionId: number, userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const endTime = new Date()

      const result = await pool
        .request()
        .input("SessionId", Int, sessionId)
        .input("UserId", Int, userId)
        .input("EndTime", DateTime, endTime)
        .query(`
          UPDATE [ChargingSession] SET EndTime = @EndTime, Status = 'COMPLETED' 
          WHERE SessionId = @SessionId AND UserId = @UserId
        `)

      if (result.rowsAffected[0] === 0) {
        throw new Error("Session not found or unauthorized")
      }

      return { message: "Session ended successfully", endTime }
    } catch (error) {
      throw new Error("Error ending charging session")
    }
  }

  async getSessionDetails(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("SessionId", Int, sessionId)
        .query(`
          SELECT * FROM [ChargingSession] WHERE SessionId = @SessionId
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
        .input("UserId", Int, userId)
        .query(`
          SELECT * FROM [ChargingSession] WHERE UserId = @UserId ORDER BY StartTime DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching user sessions")
    }
  }

  async calculatePenalty(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("SessionId", Int, sessionId)
        .query(`
          SELECT 
            SessionId,
            DATEDIFF(HOUR, StartTime, EndTime) as DurationHours,
            CASE 
              WHEN DATEDIFF(HOUR, StartTime, EndTime) > 2 THEN (DATEDIFF(HOUR, StartTime, EndTime) - 2) * 50000
              ELSE 0
            END as PenaltyAmount
          FROM [ChargingSession] WHERE SessionId = @SessionId
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error("Error calculating penalty")
    }
  }
}

export const chargingSessionService = new ChargingSessionService()
