import { getDbPool } from "../config/database"

export class StaffService {
  async getVehicleByPlate(licensePlate: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("licensePlate", licensePlate)
        .query(`
          SELECT 
            v.*,
            u.Mail,
            u.UserName,
            u.RoleName,
            c.CompanyName
          FROM [Vehicle] v
          LEFT JOIN [User] u ON v.UserId = u.UserId
          LEFT JOIN [Company] c ON v.CompanyId = c.CompanyId
          WHERE v.LicensePlate = @licensePlate
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching vehicle by plate")
    }
  }

  async startDirectSession(
    vehicleId: number,
    stationId: number,
    portId: number,
    batteryPercentage: number,
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      const checkinTime = new Date()

      const result = await pool
        .request()
        .input("VehicleId", vehicleId)
        .input("StationId", stationId)
        .input("CheckinTime", checkinTime)
        .input("ChargingStatus", "ONGOING")
        .input("BatteryPercentage", batteryPercentage)
        .input("Status", 1)
        .query(`
          INSERT INTO [ChargingSession] (VehicleId, StationId, CheckinTime, ChargingStatus, BatteryPercentage, Status)
          OUTPUT INSERTED.SessionId
          VALUES (@VehicleId, @StationId, @CheckinTime, @ChargingStatus, @BatteryPercentage, @Status)
        `)

      return { sessionId: result.recordset[0].SessionId, checkinTime }
    } catch (error) {
      throw new Error("Error starting direct session: " + error)
    }
  }

  async endDirectSession(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const checkoutTime = new Date()

      await pool
        .request()
        .input("SessionId", sessionId)
        .input("CheckoutTime", checkoutTime)
        .query(`
          UPDATE [ChargingSession]
          SET CheckoutTime = @CheckoutTime, ChargingStatus = 'COMPLETED', Status = 0
          WHERE SessionId = @SessionId
        `)

      return { message: "Session ended successfully", checkoutTime }
    } catch (error) {
      throw new Error("Error ending direct session")
    }
  }

  async processDirectPayment(sessionId: number, amount: number, paymentMethod: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const paymentTime = new Date()

      const result = await pool
        .request()
        .input("SessionId", sessionId)
        .input("TotalAmount", amount)
        .input("PaymentTime", paymentTime)
        .input("PaymentStatus", "Paid")
        .input("PaymentType", paymentMethod)
        .query(`
          INSERT INTO [Payment] (SessionId, TotalAmount, PaymentTime, PaymentStatus, PaymentType)
          OUTPUT INSERTED.PaymentId
          VALUES (@SessionId, @TotalAmount, @PaymentTime, @PaymentStatus, @PaymentType)
        `)

      return { paymentId: result.recordset[0].PaymentId, status: "Paid" }
    } catch (error) {
      throw new Error("Error processing direct payment: " + error)
    }
  }

  async getStationSessions(stationId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("StationId", stationId)
        .query(`
          SELECT cs.*, v.LicensePlate, v.VehicleName
          FROM [ChargingSession] cs
          JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          WHERE cs.StationId = @StationId
          ORDER BY cs.CheckinTime DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching station sessions")
    }
  }

  async addPenaltyToSession(sessionId: number, penaltyFee: number): Promise<void> {
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
}

export const staffService = new StaffService()
