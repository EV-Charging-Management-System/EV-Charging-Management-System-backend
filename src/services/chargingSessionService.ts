import { getDbPool } from "../config/database"

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
      
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const checkoutTime = now.toISOString().slice(0, 19).replace('T', ' ')

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
        const session = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`
          SELECT * FROM [ChargingSession] WHERE SessionId = @SessionId
        `);
        const port  = await pool
        .request()
        .input("PortId", result.recordset[0].PortId)
        .query(`
          SELECT * FROM [ChargingPort] WHERE PortId = @PortId
        `);
        const status = "AVAILABLE"
      await pool.request().input("status", status).input("portid", port.recordset[0].PortId).query("UPDATE [ChargingPort] SET [PortStatus] = @Status WHERE PortId = @PortId")
      if (session.recordset.length === 0) {
        throw new Error("Session not found")
      }
      const mathTime = new Date(checkoutTime).getTime() - 10 *60 *1000;
      if (mathTime > new Date(result.recordset[0].CheckinTime + result.recordset[0].TotalTime * 60 * 1000).getTime()) {
        const Math1 = mathTime - new Date(result.recordset[0].CheckinTime + result.recordset[0].TotalTime * 60 * 1000).getTime();
        const totalTime = Math.abs(Math1 / (60 * 1000)); // convert milliseconds to minutes
        const number = Math.ceil(totalTime); // round up to nearest minute
        const pee =  number * 3000; // assuming rate is 3000 VND per minute
        await pool
        .request()
        .input("SessionId", sessionId)
        .input("PenaltyFee", pee)
        .query(`
          UPDATE [ChargingSession] SET PenaltyFee = @PenaltyFee WHERE SessionId = @SessionId
        `);
        const price2 = result.recordset[0].TotalTime * port.recordset[0].PortTypeOfKwh * port.recordset[0].PortTypePrice;
        await pool
        .request()
        .input("SessionId", sessionId)
        .input("TotalPrice", price2)
        .query(`
          UPDATE [ChargingSession] SET SessionPrice = @TotalPrice WHERE SessionId = @SessionId
        `);
      }
      if (mathTime < new Date(result.recordset[0].CheckinTime + result.recordset[0].TotalTime * 60 * 1000 ).getTime()) {
        if(result.recordset[0].CheckoutTime < result.recordset[0].CheckinTime + result.recordset[0].TotalTime * 60 * 1000){
          const x = Math.abs(new Date(result.recordset[0].CheckoutTime).getTime() - new Date(result.recordset[0].CheckinTime).getTime());
          const totalTime = Math.ceil(x / (60 * 1000)); // convert milliseconds to minutes
          const price1 = totalTime * port.recordset[0].PortTypeOfKwh * port.recordset[0].PortTypePrice;
          await pool
          .request()
          .input("SessionId", sessionId)
          .input("TotalPrice", price1)
          .query(`
            UPDATE [ChargingSession] SET SessionPrice = @TotalPrice WHERE SessionId = @SessionId
          `);
        } 
      else{
        const price2 = result.recordset[0].TotalTime * port.recordset[0].PortTypeOfKwh * port.recordset[0].PortTypePrice;
        await pool
        .request()
        .input("SessionId", sessionId)
        .input("TotalPrice", price2)
        .query(`
          UPDATE [ChargingSession] SET SessionPrice = @TotalPrice WHERE SessionId = @SessionId
        `);
      }
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

  // async addPenalty(sessionId: number, penaltyFee: number): Promise<void> {
  //   const pool = await getDbPool()
  //   try {
  //     await pool
  //       .request()
  //       .input("SessionId", sessionId)
  //       .input("PenaltyFee", penaltyFee)
  //       .query(`
  //         UPDATE [ChargingSession] SET PenaltyFee = @PenaltyFee WHERE SessionId = @SessionId
  //       `)
  //   } catch (error) {
  //     throw new Error("Error adding penalty")
  //   }
  // }

  // async calculateSessionPrice(sessionId: number, discountPercent = 0): Promise<number> {
  //   const pool = await getDbPool()
  //   try {
  //     const result = await pool
  //       .request()
  //       .input("SessionId", sessionId)
  //       .query(`
  //         SELECT 
  //           DATEDIFF(MINUTE, CheckinTime, CheckoutTime) as DurationMinutes,
  //           PortTypeOfKwh
  //         FROM [ChargingSession] cs
  //         JOIN [ChargingPort] cp ON cs.VehicleId = cp.PortId
  //         WHERE cs.SessionId = @SessionId
  //       `)

  //     if (result.recordset.length === 0) return 0

  //     const { DurationMinutes, PortTypeOfKwh } = result.recordset[0]
  //     const basePrice = (DurationMinutes / 60) * PortTypeOfKwh * 1000
  //     const discountedPrice = basePrice * (1 - discountPercent / 100)

  //     return discountedPrice
  //   } catch (error) {
  //     throw new Error("Error calculating session price")
  //   }
  // }
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
        .query(`INSERT INTO [Invoice] (UserId, SessionId, CompanyId, TotalAmount,PaidStatus) VALUES (@UserId, @SessionId, @CompanyId, @Amount,@Status)`)
    } catch (error) {
      throw new Error("Error generating invoice")
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
  
}
export const chargingSessionService = new ChargingSessionService()
