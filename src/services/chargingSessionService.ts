import { getDbPool } from "../config/database"
import { stationService } from "./stationService"

export class ChargingSessionService {
  async startSession(bookingId: number, vehicleId: number, stationId: number, pointId: number, portId: number, batteryPercentage: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const status = "DONE"
      await pool.request().input("status", status).input("bookingid", bookingId).query("UPDATE [Booking] SET [Status] = @Status WHERE BookingId = @BookingId")
         const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const checkinTime = now.toISOString().slice(0, 19).replace('T', ' ')
      const chargingStatus = "ONGOING"
      const X = await pool.request().input("VehicleId", vehicleId).query("SELECT * FROM [Vehicle] WHERE VehicleId = @VehicleId")
      const Battery = X.recordset[0]?.Battery
      const port = await pool.request().input("PortId", portId).query("SELECT * FROM [ChargingPort] WHERE PortId = @PortId")
      const kwh = port.recordset[0]?.PortTypeOfKwh
      const totaltime = Math.round((Battery - (Battery * batteryPercentage/100))/kwh)
     // Giả sử mỗi phần trăm pin tương ứng với 0.5 giờ sạc
      const result = await pool
        .request()
        .input("BookingId", bookingId)
        .input("VehicleId", vehicleId)
        .input("StationId", stationId)
        .input("PointId", pointId)
        .input("PortId", portId)
        .input("TotalTime", totaltime)
        .input("CheckinTime", checkinTime)
        .input("ChargingStatus", chargingStatus)
        .input("BatteryPercentage", batteryPercentage)
        .input("Status", 1)
        .query(`
          INSERT INTO [ChargingSession] (BookingId, VehicleId, StationId, CheckinTime, ChargingStatus, PointId, PortId, TotalTime, BatteryPercentage, Status)
          OUTPUT INSERTED.SessionId
          VALUES (@BookingId, @VehicleId, @StationId, @CheckinTime, @ChargingStatus, @PointId, @PortId, @TotalTime, @BatteryPercentage, @Status)
        `)

      return { sessionId: result.recordset[0].SessionId, checkinTime, chargingStatus }
    } catch (error) {
      throw new Error("Error starting charging session: " + error)
    }
  }

  async endSession(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      // Current time (UTC+7) formatted for SQL DATETIME
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const checkoutTime = now.toISOString().slice(0, 19).replace("T", " ")

      // 1) Load session first to get CheckinTime, TotalTime, PortId, PointId
      const sessionRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT SessionId, CheckinTime, TotalTime, PortId, PointId FROM [ChargingSession] WHERE SessionId = @SessionId`)
      if (sessionRes.recordset.length === 0) {
        throw new Error("Session not found")
      }
      const sessionRow = sessionRes.recordset[0]

      // 2) Update checkout and status
      await pool
        .request()
        .input("SessionId", sessionId)
        .input("CheckoutTime", checkoutTime)
        .query(`
          UPDATE [ChargingSession]
          SET CheckoutTime = @CheckoutTime, ChargingStatus = 'COMPLETED', Status = 0
          WHERE SessionId = @SessionId
        `)

      // 3) Load port data
      const portRes = await pool
        .request()
        .input("PortId", sessionRow.PortId)
        .query(`SELECT PortTypeOfKwh, PortTypePrice FROM [ChargingPort] WHERE PortId = @PortId`)
      const portRow = portRes.recordset[0]

      // 4) Compute pricing and penalty safely
      const checkinDate = new Date(sessionRow.CheckinTime)
      const checkoutDate = new Date(checkoutTime)
      const plannedMinutes = Math.max(0, Math.ceil(Number(sessionRow.TotalTime || 0)))
      const actualMinutes = Math.max(0, Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (60 * 1000)))

      const plannedEnd = new Date(checkinDate.getTime() + plannedMinutes * 60 * 1000)
      const graceEnd = new Date(plannedEnd.getTime() + 10 * 60 * 1000) // 10 minutes grace

      const rateKwh = Number(portRow?.PortTypeOfKwh || 0)
      const ratePrice = Number(portRow?.PortTypePrice || 0)

      let sessionPrice = 0
      let penaltyFee = 0

      if (checkoutDate > graceEnd) {
        // Overtime beyond grace -> penalty, base price is planned minutes
        const overtimeMs = checkoutDate.getTime() - graceEnd.getTime()
        const penaltyMinutes = Math.max(0, Math.ceil(overtimeMs / (60 * 1000)))
        penaltyFee = penaltyMinutes * 3000
        sessionPrice = plannedMinutes * rateKwh * ratePrice
      } else if (checkoutDate < plannedEnd) {
        // Early finish -> pay by actual usage
        sessionPrice = actualMinutes * rateKwh * ratePrice
      } else {
        // On time (within grace) -> planned minutes
        sessionPrice = plannedMinutes * rateKwh * ratePrice
      }

      // 5) Persist price/penalty in one go
      await pool
        .request()
        .input("SessionId", sessionId)
        .input("PenaltyFee", penaltyFee)
        .input("TotalPrice", sessionPrice)
        .query(`
          UPDATE [ChargingSession]
          SET PenaltyFee = @PenaltyFee, SessionPrice = @TotalPrice
          WHERE SessionId = @SessionId
        `)

      // 6) Free the port and update point status
      await pool
        .request()
        .input("PortId", sessionRow.PortId)
        .input("Status", "AVAILABLE")
        .query(`UPDATE [ChargingPort] SET [PortStatus] = @Status WHERE PortId = @PortId`)

      // Ensure we await station service update if it's async
      await stationService.updatePointStatus(sessionRow.PointId, "AVAILABLE")

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
      const sessionRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`
          SELECT SessionId, CheckinTime, CheckoutTime, TotalTime, PortId
          FROM [ChargingSession]
          WHERE SessionId = @SessionId
        `)

      if (sessionRes.recordset.length === 0) return 0
      const s = sessionRes.recordset[0]

      const portRes = await pool
        .request()
        .input("PortId", s.PortId)
        .query(`
          SELECT PortTypeOfKwh, PortTypePrice
          FROM [ChargingPort]
          WHERE PortId = @PortId
        `)

      if (portRes.recordset.length === 0) return 0
      const p = portRes.recordset[0]

      let durationMinutes: number
      if (s.CheckoutTime) {
        const start = new Date(s.CheckinTime)
        const end = new Date(s.CheckoutTime)
        durationMinutes = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (60 * 1000)))
      } else {
        durationMinutes = Number(s.TotalTime) || 0
      }

      const basePrice = durationMinutes * Number(p.PortTypeOfKwh || 0) * Number(p.PortTypePrice || 0)
      const discounted = basePrice * (1 - Math.max(0, Math.min(100, discountPercent)) / 100)
      return Math.max(0, Math.round(discounted))
    } catch (error) {
      throw new Error("Error calculating session price")
    }
  }
  async generateInvoiceService(sessionId: number, userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const company = await pool.request().input("UserId", userId).query(`SELECT CompanyId FROM [User] WHERE UserId = @UserId`)
      const session = await pool.request().input("SessionId", sessionId).query(`SELECT * FROM [ChargingSession] WHERE SessionId = @SessionId`)
      await pool
        .request()
        .input("UserId", userId)
        .input("SessionId", sessionId)
        .input("CompanyId", company.recordset[0]?.CompanyId || null)
        .input("Amount", session.recordset[0]?.SessionPrice + session.recordset[0]?.PenaltyFee || 0)
        .input("Status", "Pending")
        .query(`INSERT INTO [Invoice] (UserId, SessionId, CompanyId, TotalAmount, PaidStatus) VALUES (@UserId, @SessionId, @CompanyId, @Amount, @Status)`)
      return true
    } catch (error) {
      throw new Error("Error generating invoice")
    }
  }

  // Staff: create/update invoice for a session with explicit userId
  async upsertInvoiceByStaff(sessionId: number, userId: number): Promise<{ invoiceId: number; totalAmount: number; paidStatus: string }>{
    const pool = await getDbPool()
    try {
      // Validate session and compute amount
      const sRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT SessionId, SessionPrice, PenaltyFee FROM [ChargingSession] WHERE SessionId = @SessionId`)
      if (sRes.recordset.length === 0) throw new Error("Session not found")
      const session = sRes.recordset[0]
      const amount = Number(session.SessionPrice || 0) + Number(session.PenaltyFee || 0)

      // Get company of user
      const cRes = await pool
        .request()
        .input("UserId", userId)
        .query(`SELECT CompanyId FROM [User] WHERE UserId = @UserId`)
      const companyId = cRes.recordset[0]?.CompanyId ?? null

      // Check existing invoice for session
      const existing = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT TOP 1 InvoiceId, PaidStatus FROM [Invoice] WHERE SessionId = @SessionId ORDER BY InvoiceId DESC`)

      if (existing.recordset.length > 0) {
        const invoiceId = existing.recordset[0].InvoiceId
        await pool
          .request()
          .input("InvoiceId", invoiceId)
          .input("UserId", userId)
          .input("CompanyId", companyId)
          .input("Amount", amount)
          .query(`UPDATE [Invoice] SET UserId = @UserId, CompanyId = @CompanyId, TotalAmount = @Amount WHERE InvoiceId = @InvoiceId`)
        const paidStatus = existing.recordset[0].PaidStatus || "Pending"
        return { invoiceId, totalAmount: amount, paidStatus }
      }

      // Insert new invoice
      const ins = await pool
        .request()
        .input("UserId", userId)
        .input("SessionId", sessionId)
        .input("CompanyId", companyId)
        .input("Amount", amount)
        .input("Status", "Pending")
        .query(`INSERT INTO [Invoice] (UserId, SessionId, CompanyId, TotalAmount, PaidStatus) OUTPUT INSERTED.InvoiceId VALUES (@UserId, @SessionId, @CompanyId, @Amount, @Status)`)
      const invoiceId = ins.recordset[0].InvoiceId
      return { invoiceId, totalAmount: amount, paidStatus: "Pending" }
    } catch (error) {
      throw new Error("Error upserting invoice by staff: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  // Create invoice for guest session (no user account). Initially UNPAID then staff pays immediately.
  async createGuestInvoiceByStaff(sessionId: number): Promise<{ invoiceId: number; totalAmount: number; paidStatus: string }> {
    const pool = await getDbPool()
    try {
      const sessionRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT SessionPrice, PenaltyFee FROM [ChargingSession] WHERE SessionId = @SessionId`)
      const s = sessionRes.recordset[0]
      if (!s) throw new Error("Session not found")
      const total = Number(s.SessionPrice || 0) + Number(s.PenaltyFee || 0)

      const invRes = await pool
        .request()
        .input("SessionId", sessionId)
        .input("TotalAmount", total)
        .input("PaidStatus", "Pending")
        .input("CreatedAt", new Date())
        .query(`
          INSERT INTO [Invoice] (SessionId, TotalAmount, PaidStatus, CreatedAt)
          OUTPUT INSERTED.InvoiceId
          VALUES (@SessionId, @TotalAmount, @PaidStatus, @CreatedAt)
        `)

      const invoiceId = invRes.recordset[0].InvoiceId
      return { invoiceId, totalAmount: total, paidStatus: "Pending" }
    } catch (error) {
      throw new Error("Error creating guest invoice by staff: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  async startSessionForGuest(stationId: number, pointId: number, portId: number, battery : number, batteryPercentage: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const status = "IN_USE"
      await pool.request().input("status", status).input("portid", portId).query("UPDATE [ChargingPort] SET [PortStatus] = @Status WHERE PortId = @PortId")
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const checkinTime = now.toISOString().slice(0, 19).replace('T', ' ')
      const chargingStatus = "ONGOING"
      const port = await pool.request().input("PortId", portId).query("SELECT * FROM [ChargingPort] WHERE PortId = @PortId")
      const kwh = port.recordset[0]?.PortTypeOfKwh
      const totaltime = Math.round((battery - (battery * batteryPercentage/100))/kwh)
     // Giả sử mỗi phần trăm pin tương ứng với 0.5 giờ sạc
      const result = await pool
        .request()
        .input("StationId", stationId)
        .input("PointId", pointId)
        .input("PortId", portId)
        .input("TotalTime", totaltime)
        .input("CheckinTime", checkinTime)
        .input("ChargingStatus", chargingStatus)
        .input("BatteryPercentage", batteryPercentage)
        .input("Status", 1)
        .query(`
          INSERT INTO [ChargingSession] (StationId, PointId, PortId, CheckinTime, ChargingStatus, TotalTime, BatteryPercentage, Status)
          OUTPUT INSERTED.SessionId
          VALUES (@StationId, @PointId, @PortId, @CheckinTime, @ChargingStatus, @TotalTime, @BatteryPercentage, @Status)
        `)
stationService.updatePointStatus(pointId, "BUSY");
      return { sessionId: result.recordset[0].SessionId, checkinTime, chargingStatus }
    } catch (error) {
      throw new Error("Error starting charging session: " + error)
    }
  }
  async startSessionStaff(stationId: number, pointId: number, portId: number, licensePlate: string, batteryPercentage: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const status = "IN_USE"
      await pool.request().input("status", status).input("portid", portId).query("UPDATE [ChargingPort] SET [PortStatus] = @Status WHERE PortId = @PortId")
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const checkinTime = now.toISOString().slice(0, 19).replace('T', ' ')
      const chargingStatus = "ONGOING"
      const X = await pool.request().input("licensePlate", licensePlate).query("SELECT * FROM [Vehicle] WHERE LicensePlate = @LicensePlate")
      const Battery = X.recordset[0]?.Battery
      const port = await pool.request().input("PortId", portId).query("SELECT * FROM [ChargingPort] WHERE PortId = @PortId")
      const kwh = port.recordset[0]?.PortTypeOfKwh
      const totaltime = Math.round((Battery - (Battery * batteryPercentage/100))/kwh)
     // Giả sử mỗi phần trăm pin tương ứng với 0.5 giờ sạc
      const result = await pool
        
        .request()
        .input("VehicleId", X.recordset[0]?.VehicleId)
        .input("StationId", stationId)
        .input("PointId", pointId)
        .input("PortId", portId)
        .input("TotalTime", totaltime)
        .input("CheckinTime", checkinTime)
        .input("ChargingStatus", chargingStatus)
        .input("BatteryPercentage", batteryPercentage)
        .input("Status", 1)
        .query(`
          INSERT INTO [ChargingSession] (StationId, PointId, PortId, CheckinTime, ChargingStatus, TotalTime, BatteryPercentage, Status, VehicleId)
          OUTPUT INSERTED.SessionId
          VALUES (@StationId, @PointId, @PortId, @CheckinTime, @ChargingStatus, @TotalTime, @BatteryPercentage, @Status, @VehicleId)
        `)
await stationService.updatePointStatus(pointId, "BUSY")
      return { sessionId: result.recordset[0].SessionId, checkinTime, chargingStatus }
    } catch (error) {
      throw new Error("Error starting charging session: " + error)
    }
  }
 
  async getSessionDetailsGuest(sessionId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input("SessionId", sessionId)
      .query(`SELECT * FROM [ChargingSession] WHERE SessionId = @SessionId`)
      await pool
        .request()
        .input("SessionId", sessionId)
        return result.recordset[0]
    } catch (error) {
      throw new Error("Error generating invoice")
    }
  }
  //jos
  async updateBatteryPercentage(sessionId: number, batteryPercentage: number): Promise<any> {
  const pool = await getDbPool()
  try {
    const result = await pool
      .request()
      .input("SessionId", sessionId)
      .input("BatteryPercentage", batteryPercentage)
      .query(`
        UPDATE [ChargingSession]
        SET BatteryPercentage = @BatteryPercentage
        WHERE SessionId = @SessionId;
        SELECT * FROM [ChargingSession] WHERE SessionId = @SessionId;
      `)

    if (result.recordset.length === 0) {
      throw new Error("Session not found abc abc")
    }

    return {
      message: "Battery percentage updated successfully",
      session: result.recordset[0]
    }
  } catch (error) {
    throw new Error("Error updating battery percentage: " + error)
  }
}
}
export const chargingSessionService = new ChargingSessionService()