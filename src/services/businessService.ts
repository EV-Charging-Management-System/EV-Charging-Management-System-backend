import { getDbPool } from "../config/database"
import { Int, NVarChar, VarChar } from "mssql"
import { companyService } from "./companyService"
import { vehicleService } from "./vehicleService"

export class BusinessService {
  async getBusinessProfile(userId: number): Promise<any | null> {
    const pool = await getDbPool()
    const result = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT
          u.UserId,
          u.UserName,
          u.Mail,
          u.RoleName,
          c.CompanyId,
          c.CompanyName,
          c.Address,
          c.Phone,
          c.Mail AS CompanyMail
        FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.UserId = @UserId
      `)
    return result.recordset[0] || null
  }

  async getUserCompanyId(userId: number): Promise<number | null> {
    const pool = await getDbPool()
    const rs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`SELECT TOP 1 CompanyId FROM [User] WHERE UserId = @UserId`)
    const companyId = rs.recordset[0]?.CompanyId as number | undefined
    return companyId ?? null
  }

  async getCompanyInvoiceAggregates(companyId: number): Promise<{ totalInvoicesPaid: number; totalAmount: number }> {
    const pool = await getDbPool()
    const agg = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`
        SELECT 
          COUNT(*) AS totalInvoicesPaid,
          ISNULL(SUM(TotalAmount), 0) AS totalAmount
        FROM [Invoice]
        WHERE CompanyId = @CompanyId AND PaidStatus IN ('Paid','PAID')
      `)
    return {
      totalInvoicesPaid: agg.recordset[0]?.totalInvoicesPaid || 0,
      totalAmount: agg.recordset[0]?.totalAmount || 0,
    }
  }

  async getCompanyInvoices(companyId: number, status?: string): Promise<any[]> {
    const pool = await getDbPool()
    const request = pool.request().input("CompanyId", Int, companyId)
    let statusFilter = ""
    if (status) {
      request.input("PaidStatus", VarChar(20), status)
      statusFilter = " AND i.PaidStatus = @PaidStatus"
    }
    const rs = await request.query(`
      SELECT 
        i.InvoiceId,
        i.UserId,
        i.SessionId,
        i.CompanyId,
        i.TotalAmount,
        i.PaidStatus,
        i.CreatedAt,
        u.UserName,
        v.VehicleName,
        v.LicensePlate
      FROM [Invoice] i
      LEFT JOIN [User] u ON u.UserId = i.UserId
      LEFT JOIN [ChargingSession] cs ON cs.SessionId = i.SessionId
      LEFT JOIN [Vehicle] v ON v.VehicleId = cs.VehicleId
      WHERE (
        i.CompanyId = @CompanyId
        OR EXISTS (SELECT 1 FROM [User] u2 WHERE u2.UserId = i.UserId AND u2.CompanyId = @CompanyId)
        OR EXISTS (
          SELECT 1 
          FROM [ChargingSession] cs2 
          INNER JOIN [Vehicle] v2 ON cs2.VehicleId = v2.VehicleId 
          WHERE cs2.SessionId = i.SessionId AND v2.CompanyId = @CompanyId
        )
        OR EXISTS (SELECT 1 FROM [Vehicle] vu WHERE vu.UserId = i.UserId AND vu.CompanyId = @CompanyId)
      )${statusFilter}
      ORDER BY ISNULL(i.CreatedAt, GETDATE()) DESC, i.InvoiceId DESC
    `)

    return rs.recordset.map((x: any) => ({
      invoiceId: x.InvoiceId,
      userId: x.UserId ?? null,
      sessionId: x.SessionId ?? null,
      companyId: x.CompanyId,
      totalAmount: Number(x.TotalAmount || 0),
      paidStatus: x.PaidStatus,
      createdAt: x.CreatedAt,
      userName: x.UserName ?? null,
      vehicleName: x.VehicleName ?? null,
      licensePlate: x.LicensePlate ?? null,
    }))
  }

  async getCompanySessions(companyId: number, bookingId?: number): Promise<any[]> {
    const pool = await getDbPool()
    const request = pool.request().input("CompanyId", Int, companyId)
    let whereClause = "v.CompanyId = @CompanyId"
    if (bookingId && !Number.isNaN(bookingId)) {
      request.input("BookingId", Int, bookingId)
      whereClause += " AND cs.BookingId = @BookingId"
    }

    const rs = await request.query(`
      SELECT 
        cs.SessionId, cs.StationId, cs.PointId, cs.PortId, cs.BookingId, cs.VehicleId,
        cs.TotalTime, cs.ChargingStatus, cs.Pause, cs.SessionPrice, cs.CheckinTime, cs.CheckoutTime,
        cs.Status, cs.PenaltyFee, cs.BatteryPercentage,
        v.LicensePlate, v.VehicleName
      FROM [ChargingSession] cs
      INNER JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
      WHERE ${whereClause}
      ORDER BY cs.CheckoutTime DESC, cs.SessionId DESC
    `)
    return rs.recordset
  }

  async getPaymentsSummaryByPlate(licensePlate: string, companyId: number): Promise<any> {
    const pool = await getDbPool()
    const vRs = await pool
      .request()
      .input("LicensePlate", VarChar(100), licensePlate)
      .query(`SELECT TOP 1 VehicleId, CompanyId, UserId, VehicleName FROM [Vehicle] WHERE LicensePlate = @LicensePlate`)
    const vehicle = vRs.recordset[0]
    if (!vehicle || vehicle.CompanyId !== companyId) {
      return { notFound: true }
    }

    const userId = vehicle.UserId as number | undefined
    if (!userId) {
      return { noUser: true }
    }

    const uRs = await pool.request().input("UserId", Int, userId).query(`SELECT UserId, UserName FROM [User] WHERE UserId = @UserId`)
    const user = uRs.recordset[0]

    const sumsRs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT 
          COUNT(*) AS CountPayments,
          ISNULL(SUM(TotalAmount),0) AS TotalAmount,
          ISNULL(SUM(CASE WHEN PaymentStatus IN ('Paid','PAID') THEN TotalAmount ELSE 0 END),0) AS PaidAmount,
          ISNULL(SUM(CASE WHEN PaymentStatus = 'Pending' THEN TotalAmount ELSE 0 END),0) AS PendingAmount
        FROM [Payment]
        WHERE UserId = @UserId
      `)

    const row = sumsRs.recordset[0] || { CountPayments: 0, TotalAmount: 0, PaidAmount: 0, PendingAmount: 0 }
    return {
      companyId,
      licensePlate,
      user: user ? { userId: user.UserId, name: user.UserName } : null,
      paymentsSummary: {
        totalCount: Number(row.CountPayments || 0),
        totalAmount: Number(row.TotalAmount || 0),
        paidAmount: Number(row.PaidAmount || 0),
        pendingAmount: Number(row.PendingAmount || 0),
      },
    }
  }

  async getInvoicePaymentByPlate(licensePlate: string, companyId: number): Promise<any> {
    const pool = await getDbPool()
    const vRs = await pool
      .request()
      .input("LicensePlate", VarChar(50), licensePlate)
      .query(`SELECT TOP 1 VehicleId, CompanyId, UserId FROM [Vehicle] WHERE LicensePlate = @LicensePlate`)
    const vehicle = vRs.recordset[0]
    if (!vehicle || vehicle.CompanyId !== companyId) {
      return { notFound: true }
    }

    const uRs = await pool
      .request()
      .input("VehicleId", Int, vehicle.VehicleId)
      .query(`
        SELECT TOP 1 u.UserId, u.UserName
        FROM [ChargingSession] cs
        INNER JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
        INNER JOIN [User] u ON v.UserId = u.UserId
        WHERE cs.VehicleId = @VehicleId
        ORDER BY cs.CheckoutTime DESC
      `)

    const u = uRs.recordset[0]
    const userId = u?.UserId as number | undefined

    let invoices: any[] = []
    let payments: any[] = []
    if (userId) {
      const invRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT InvoiceId, SessionId, TotalAmount, PaidStatus, CreatedAt
          FROM [Invoice]
          WHERE UserId = @UserId
          ORDER BY CreatedAt DESC
        `)
      invoices = invRs.recordset

      const payRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT PaymentId, TotalAmount, PaymentStatus, PaymentTime
          FROM [Payment]
          WHERE UserId = @UserId
          ORDER BY PaymentTime DESC
        `)
      payments = payRs.recordset
    }

    return {
      companyId,
      licensePlate,
      user: userId ? { userId, name: u.UserName } : null,
      invoices: invoices.map((x) => ({
        invoiceId: x.InvoiceId,
        sessionId: x.SessionId ?? null,
        totalAmount: x.TotalAmount,
        paidStatus: x.PaidStatus,
      })),
      payments: payments.map((p) => ({
        paymentId: p.PaymentId,
        totalAmount: p.TotalAmount,
        paymentStatus: p.PaymentStatus,
        paymentTime: p.PaymentTime,
      })),
    }
  }

  async getCompanyOverview(companyId: number): Promise<any> {
    const pool = await getDbPool()

    const cRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`SELECT TOP 1 CompanyName FROM [Company] WHERE CompanyId = @CompanyId`)
    const companyName = cRs.recordset[0]?.CompanyName ?? null

    const sessRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`
        SELECT COUNT(*) AS TotalSessions, ISNULL(SUM(ISNULL(cs.PenaltyFee,0)),0) AS TotalPenalty
        FROM [ChargingSession] cs
        INNER JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
        WHERE v.CompanyId = @CompanyId
      `)
    const totalSessions = Number(sessRs.recordset[0]?.TotalSessions || 0)
    const vehicleRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`
        SELECT COUNT(*) AS TotalVehicles
        FROM [Vehicle]
        WHERE CompanyId = @CompanyId
      `)
    const totalVehicles = Number(vehicleRs.recordset[0]?.TotalVehicles || 0)
    const totalPenaltyFee = Number(sessRs.recordset[0]?.TotalPenalty || 0)

    const invCountRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`
        SELECT 
          COUNT(*) AS Total,
          SUM(CASE WHEN PaidStatus = 'Paid' THEN 1 ELSE 0 END) AS Paid
        FROM [Invoice]
        WHERE CompanyId = @CompanyId
      `)
    const totalInvoices = Number(invCountRs.recordset[0]?.Total || 0)
    const paidInvoices = Number(invCountRs.recordset[0]?.Paid || 0)
    const unpaidInvoices = Math.max(0, totalInvoices - paidInvoices)

    const payRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`
        SELECT ISNULL(SUM(p.TotalAmount),0) AS TotalAmount
        FROM [Payment] p
        LEFT JOIN [Invoice] i ON p.InvoiceId = i.InvoiceId
        LEFT JOIN [ChargingSession] cs ON p.SessionId = cs.SessionId
        LEFT JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
        WHERE p.PaymentStatus IN ('Paid','PAID')
          AND (i.CompanyId = @CompanyId OR v.CompanyId = @CompanyId)
      `)
    const totalRevenue = Number(payRs.recordset[0]?.TotalAmount || 0)

    const topRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`
        SELECT TOP 5 u.UserId, u.UserName AS Name,
               ISNULL(SUM(p.TotalAmount),0) AS TotalSpent,
               ISNULL(COUNT(DISTINCT cs.SessionId),0) AS Sessions
        FROM [User] u
        LEFT JOIN [Payment] p ON p.UserId = u.UserId AND p.PaymentStatus IN ('Paid','PAID')
        LEFT JOIN [Vehicle] v ON v.UserId = u.UserId AND v.CompanyId = @CompanyId
        LEFT JOIN [ChargingSession] cs ON cs.VehicleId = v.VehicleId
        WHERE u.CompanyId = @CompanyId
        GROUP BY u.UserId, u.UserName
        ORDER BY TotalSpent DESC
      `)

    const subRs = await pool
      .request()
      .input("CompanyId", Int, companyId)
      .query(`SELECT COUNT(*) AS Cnt FROM [Subscription] WHERE CompanyId = @CompanyId AND SubStatus = 'ACTIVE'`)
    const subscriptionCount = Number(subRs.recordset[0]?.Cnt || 0)

    return {
      companyId,
      companyName,
      totalSessions,
      totalVehicles,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      totalRevenue,
      totalPenaltyFee,
      subscriptionCount,
      topUsers: topRs.recordset.map((r: any) => ({
        userId: r.UserId,
        name: r.Name,
        totalSpent: Number(r.TotalSpent || 0),
        sessions: Number(r.Sessions || 0),
      })),
    }
  }

  // ===== Remaining extractions =====
  async createCompanyForUser(userId: number, params: { companyName?: string; address?: string; mail?: string; phone?: string }): Promise<{ httpCode: number; body: any }> {
    const name = (params.companyName ?? "").toString().trim()
    const addr = params.address?.toString().trim()
    const email = params.mail?.toString().trim()
    const phoneNum = params.phone?.toString().trim()

    if (!name) {
      return { httpCode: 400, body: { success: false, error: "companyName is required", code: "VALIDATION_ERROR", field: "companyName" } }
    }
    if (name.length > 100) {
      return { httpCode: 400, body: { success: false, error: "companyName must be at most 100 characters", code: "VALIDATION_ERROR", field: "companyName" } }
    }
    if (addr && addr.length > 100) {
      return { httpCode: 400, body: { success: false, error: "address must be at most 100 characters", code: "VALIDATION_ERROR", field: "address" } }
    }
    if (email && email.length > 100) {
      return { httpCode: 400, body: { success: false, error: "mail must be at most 100 characters", code: "VALIDATION_ERROR", field: "mail" } }
    }
    if (phoneNum && phoneNum.length > 100) {
      return { httpCode: 400, body: { success: false, error: "phone must be at most 100 characters", code: "VALIDATION_ERROR", field: "phone" } }
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return { httpCode: 400, body: { success: false, error: "Invalid email format", code: "VALIDATION_ERROR", field: "mail" } }
      }
    }
    if (phoneNum) {
      const phoneRegex = /^\+?[0-9\-\s]{8,20}$/
      if (!phoneRegex.test(phoneNum)) {
        return { httpCode: 400, body: { success: false, error: "Invalid phone format", code: "VALIDATION_ERROR", field: "phone" } }
      }
    }

    const pool = await getDbPool()

    // Check user
    const userRs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT u.UserId, u.RoleName, u.CompanyId, c.CompanyName
        FROM [User] u
        LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.UserId = @UserId
      `)
    const user = userRs.recordset[0]
    if (!user) {
      return { httpCode: 404, body: { success: false, error: "User not found", code: "USER_NOT_FOUND" } }
    }

    if (user.CompanyId) {
      const dupUpdate = await pool
        .request()
        .input("CompanyName", NVarChar(100), name)
        .input("CompanyId", Int, user.CompanyId)
        .query(`SELECT TOP 1 CompanyId FROM [Company] WHERE CompanyName = @CompanyName AND CompanyId <> @CompanyId`)
      if (dupUpdate.recordset.length > 0) {
        return { httpCode: 409, body: { success: false, error: "Company name already exists", code: "COMPANY_CONFLICT" } }
      }

      await companyService.updateCompany(user.CompanyId, {
        CompanyName: name,
        Address: addr,
        Mail: email,
        Phone: phoneNum,
      })

      return { httpCode: 200, body: { message: "Company created successfully, waiting for admin approval", companyId: user.CompanyId } }
    }

    // Check duplicate company name
    const dup = await pool
      .request()
      .input("CompanyName", NVarChar(100), name)
      .query(`SELECT TOP 1 CompanyId FROM [Company] WHERE CompanyName = @CompanyName`)
    if (dup.recordset.length > 0) {
      return { httpCode: 409, body: { success: false, error: "Company name already exists", code: "COMPANY_CONFLICT" } }
    }

    // Create company
    const newCompany = await companyService.createCompany({
      CompanyName: name,
      Address: addr,
      Mail: email,
      Phone: phoneNum,
    })

    // Attach to user
    await pool
      .request()
      .input("UserId", Int, userId)
      .input("CompanyId", Int, newCompany.CompanyId)
      .query(`UPDATE [User] SET CompanyId = @CompanyId WHERE UserId = @UserId`)

    return { httpCode: 200, body: { message: "Company created successfully, waiting for admin approval", companyId: newCompany.CompanyId } }
  }

  async addVehicleForUser(userId: number, params: { vehicleName: string; vehicleType: string; licensePlate: string; battery?: number }): Promise<{ httpCode: number; body: any }> {
    const { vehicleName, vehicleType, licensePlate, battery } = params
    const pool = await getDbPool()

    // Get user info
    const userRs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT u.UserId, u.RoleName, u.CompanyId, c.CompanyName
        FROM [User] u
        LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.UserId = @UserId
      `)
    const user = userRs.recordset[0]
    if (!user) {
      return { httpCode: 404, body: { error: "User not found" } }
    }

    // Check existing vehicle by plate
    const existingVehicleRs = await pool
      .request()
      .input("LicensePlate", VarChar(50), licensePlate)
      .query(`SELECT TOP 1 * FROM [Vehicle] WHERE LicensePlate = @LicensePlate`)
    const existingVehicle = existingVehicleRs.recordset[0]
    if (existingVehicle) {
      const belongsToOtherUser = existingVehicle.UserId && existingVehicle.UserId !== userId
      const isBusiness = user.RoleName === "BUSINESS" && user.CompanyId

      if (isBusiness && belongsToOtherUser && !existingVehicle.CompanyId) {
        await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .input("CompanyId", Int, user.CompanyId)
          .query(`UPDATE [Vehicle] SET CompanyId = @CompanyId WHERE VehicleId = @VehicleId`)

        await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .input("VehicleName", VarChar(100), vehicleName)
          .input("VehicleType", VarChar(50), vehicleType)
          .input("Battery", Int, battery ?? existingVehicle.Battery ?? 50)
          .query(`
            UPDATE [Vehicle]
            SET VehicleName = @VehicleName, VehicleType = @VehicleType, Battery = @Battery
            WHERE VehicleId = @VehicleId
          `)

        const refreshed = await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .query(`SELECT VehicleId, UserId, CompanyId, VehicleName, VehicleType, LicensePlate, Battery FROM [Vehicle] WHERE VehicleId = @VehicleId`)
        const v = refreshed.recordset[0]
        return {
          httpCode: 200,
          body: {
            message: "Vehicle attached to business successfully",
            vehicleId: v.VehicleId,
            companyId: v.CompanyId,
            licensePlate: v.LicensePlate,
            vehicleName: v.VehicleName,
            vehicleType: v.VehicleType,
            battery: v.Battery,
            attached: true,
          },
        }
      }

      if (isBusiness && !belongsToOtherUser && !existingVehicle.CompanyId) {
        await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .input("CompanyId", Int, user.CompanyId)
          .query(`UPDATE [Vehicle] SET CompanyId = @CompanyId WHERE VehicleId = @VehicleId`)

        const refreshed = await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .query(`SELECT VehicleId, UserId, CompanyId, VehicleName, VehicleType, LicensePlate, Battery FROM [Vehicle] WHERE VehicleId = @VehicleId`)
        const v = refreshed.recordset[0]
        return {
          httpCode: 200,
          body: {
            message: "Existing vehicle assigned to company successfully",
            vehicleId: v.VehicleId,
            companyId: v.CompanyId,
            licensePlate: v.LicensePlate,
            vehicleName: v.VehicleName,
            vehicleType: v.VehicleType,
            battery: v.Battery,
            attached: true,
          },
        }
      }

      if (existingVehicle.CompanyId) {
        return {
          httpCode: 200,
          body: {
            message: "Vehicle already belongs to a company",
            vehicleId: existingVehicle.VehicleId,
            companyId: existingVehicle.CompanyId,
            licensePlate: existingVehicle.LicensePlate,
            vehicleName: existingVehicle.VehicleName,
            vehicleType: existingVehicle.VehicleType,
            battery: existingVehicle.Battery,
            attached: true,
          },
        }
      }

      if (belongsToOtherUser) {
        return { httpCode: 400, body: { error: "Vehicle already belongs to another user" } }
      }

      await pool
        .request()
        .input("VehicleId", Int, existingVehicle.VehicleId)
        .input("VehicleName", VarChar(100), vehicleName)
        .input("VehicleType", VarChar(50), vehicleType)
        .input("Battery", Int, battery ?? existingVehicle.Battery ?? 50)
        .query(`
          UPDATE [Vehicle]
          SET VehicleName = @VehicleName, VehicleType = @VehicleType, Battery = @Battery
          WHERE VehicleId = @VehicleId
        `)
      const updatedSame = await pool
        .request()
        .input("VehicleId", Int, existingVehicle.VehicleId)
        .query(`SELECT VehicleId, UserId, CompanyId, VehicleName, VehicleType, LicensePlate, Battery FROM [Vehicle] WHERE VehicleId = @VehicleId`)
      const v2 = updatedSame.recordset[0]
      return {
        httpCode: 200,
        body: {
          message: "Vehicle already exists - updated details",
          vehicleId: v2.VehicleId,
          companyId: v2.CompanyId ?? null,
          licensePlate: v2.LicensePlate,
          vehicleName: v2.VehicleName,
          vehicleType: v2.VehicleType,
          battery: v2.Battery,
          attached: false,
        },
      }
    }

    if (typeof user.CompanyId === "number" && user.RoleName === "BUSINESS") {
      const companyIdNum: number = user.CompanyId
      const createdRs = await pool
        .request()
        .input('companyId', Int, companyIdNum)
        .input('vehicleName', VarChar(100), vehicleName)
        .input('vehicleType', VarChar(50), vehicleType)
        .input('licensePlate', VarChar(50), licensePlate)
        .input('battery', Int, battery ?? 50)
        .query(`
          INSERT INTO [Vehicle] (CompanyId, VehicleName, VehicleType, LicensePlate, Battery)
          OUTPUT INSERTED.VehicleId
          VALUES (@companyId, @vehicleName, @vehicleType, @licensePlate, @battery)
        `)
      const created = createdRs.recordset[0]
      return { httpCode: 201, body: { message: "Vehicle added to company successfully", vehicleId: created.VehicleId, companyId: user.CompanyId, licensePlate } }
    }

    const created = await vehicleService.addVehicle(userId, vehicleName, vehicleType, licensePlate, battery)
    return { httpCode: 201, body: { message: "Vehicle added successfully", ...created } }
  }

  async deleteVehicleByPlate(licensePlate: string, requesterUserId?: number): Promise<{ httpCode: number; body: any }> {
    const pool = await getDbPool()

    const vehicleRs = await pool
      .request()
      .input("LicensePlate", VarChar(50), licensePlate)
      .query(`SELECT TOP 1 * FROM [Vehicle] WHERE LicensePlate = @LicensePlate`)
    const vehicle = vehicleRs.recordset[0]
    if (!vehicle) {
      return { httpCode: 404, body: { error: "Vehicle not found" } }
    }

    if (vehicle.UserId && requesterUserId && vehicle.UserId !== requesterUserId) {
      return { httpCode: 403, body: { error: "Forbidden" } }
    }

    if (vehicle.CompanyId) {
      return { httpCode: 400, body: { error: "Vehicle belongs to an approved company and cannot be deleted" } }
    }

    const bookingActive = await pool
      .request()
      .input("VehicleId", Int, vehicle.VehicleId)
      .query(`SELECT TOP 1 1 FROM [Booking] WHERE VehicleId = @VehicleId AND Status = 'ACTIVE'`)
    if (bookingActive.recordset.length > 0) {
      return { httpCode: 409, body: { error: "Vehicle is in use and cannot be deleted" } }
    }

    const sessionActive = await pool
      .request()
      .input("VehicleId", Int, vehicle.VehicleId)
      .query(`SELECT TOP 1 1 FROM [ChargingSession] WHERE VehicleId = @VehicleId AND (ChargingStatus = 'ONGOING' OR Status = 1) AND CheckoutTime IS NULL`)
    if (sessionActive.recordset.length > 0) {
      return { httpCode: 409, body: { error: "Vehicle is in use and cannot be deleted" } }
    }

    await vehicleService.deleteVehicle(vehicle.VehicleId)
    return { httpCode: 200, body: { message: "Vehicle deleted successfully" } }
  }

  async getVehiclesForUser(userId: number): Promise<{ httpCode: number; body: any }> {
    const pool = await getDbPool()

    const userRs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT u.UserId, u.RoleName, u.CompanyId, c.CompanyName
        FROM [User] u
        LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.UserId = @UserId
      `)
    const user = userRs.recordset[0]
    if (!user) {
      return { httpCode: 404, body: { error: "User not found" } }
    }

    if (user.CompanyId && user.RoleName === "BUSINESS") {
      const rs = await pool
        .request()
        .input("CompanyId", Int, user.CompanyId)
        .query(`SELECT * FROM [Vehicle] WHERE CompanyId = @CompanyId ORDER BY VehicleId DESC`)
      return { httpCode: 200, body: { success: true, data: rs.recordset } }
    }

    const rs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`SELECT * FROM [Vehicle] WHERE UserId = @UserId ORDER BY VehicleId DESC`)
    return { httpCode: 200, body: { success: true, data: rs.recordset } }
  }
}

export const businessService = new BusinessService()
