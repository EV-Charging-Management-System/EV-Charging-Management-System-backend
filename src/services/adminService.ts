import { getDbPool } from "../config/database";
import bcrypt from "bcryptjs";
import sql from "mssql";
import { validateEmail } from "../utils/validation";

export class AdminService {
  // 🏢 Lấy danh sách doanh nghiệp chờ duyệt
  async getPendingBusinessApprovals(): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const result = await pool.request().query(`
        SELECT
          u.UserId,
          u.UserName,
          u.Mail,
          u.CompanyId,
          c.CompanyName,
          c.Address,
          c.Phone,
          c.Mail AS CompanyMail
        FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.CompanyId IS NOT NULL AND u.RoleName <> 'BUSINESS'
        ORDER BY u.UserId DESC;
      `);
      return result.recordset;
    } catch (error) {
      console.error("❌ Error fetching pending approvals:", error);
      throw new Error("Error fetching pending approvals");
    }
  }

  // 🏢 Lấy chi tiết một yêu cầu duyệt doanh nghiệp theo UserId
  async getPendingBusinessApprovalById(userId: number): Promise<any | null> {
    const pool = await getDbPool();
    try {
      const result = await pool
        .request()
        .input("userId", userId)
        .query(`
          SELECT
            u.UserId,
            u.UserName,
            u.Mail,
            u.CompanyId,
            c.CompanyName,
            c.Address,
            c.Phone,
            c.Mail AS CompanyMail
          FROM [User] u
            LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE u.UserId = @userId
            AND u.CompanyId IS NOT NULL
            AND u.RoleName <> 'BUSINESS'
        `);
      return result.recordset[0] || null;
    } catch (error) {
      console.error("❌ Error fetching pending approval by id:", error);
      throw new Error("Error fetching pending approval by id");
    }
  }

  // ✅ Duyệt doanh nghiệp
  async approveBusiness(userId: number): Promise<void> {
    const pool = await getDbPool();
    try {
      await pool
        .request()
        .input("userId", userId)
        .query(`
          UPDATE [User]
          SET RoleName = 'BUSINESS'
          WHERE UserId = @userId;
        `);
    } catch (error) {
      console.error("❌ Error approving business:", error);
      throw new Error("Error approving business");
    }
  }

  // ❌ Từ chối doanh nghiệp (an toàn, không xóa user)
  async rejectBusiness(userId: number): Promise<void> {
    const pool = await getDbPool();
    try {
      // Detach and delete associated company if any
      const rs = await pool.request().input("userId", userId).query(`SELECT CompanyId FROM [User] WHERE UserId = @userId`);
      const companyId = rs.recordset[0]?.CompanyId;

      await pool.request().input("userId", userId).query(`UPDATE [User] SET CompanyId = NULL WHERE UserId = @userId`);

      if (companyId) {
        await pool.request().input("CompanyId", companyId).query(`DELETE FROM [Company] WHERE CompanyId = @CompanyId`);
      }
    } catch (error) {
      console.error("❌ Error rejecting business:", error);
      throw new Error("Error rejecting business");
    }
  }

  // 👥 Lấy tất cả người dùng
  async getAllUsers(): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const result = await pool.request().query(`
        SELECT UserId, Mail, UserName, RoleName, CompanyId
        FROM [User]
        ORDER BY UserId DESC;
      `);
      return result.recordset;
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      throw new Error("Error fetching users");
    }
  }

  // 🔍 Lấy người dùng theo ID
  async getUserById(userId: number): Promise<any> {
    const pool = await getDbPool();
    try {
      const result = await pool
        .request()
        .input("userId", userId)
        .query(`SELECT * FROM [User] WHERE UserId = @userId`);
      return result.recordset[0];
    } catch (error) {
      console.error("❌ Error fetching user:", error);
      throw new Error("Error fetching user");
    }
  }

  // 🔄 Cập nhật vai trò người dùng
  async updateUserRole(userId: number, role: string): Promise<void> {
    const pool = await getDbPool();
    try {
      await pool
        .request()
        .input("userId", userId)
        .input("role", role)
        .query(`
          UPDATE [User]
          SET RoleName = @role
          WHERE UserId = @userId;
        `);
    } catch (error) {
      console.error("❌ Error updating user role:", error);
      throw new Error("Error updating user role");
    }
  }

  // 💰 Báo cáo doanh thu
  async getRevenueReport(monthYear?: string): Promise<any> {
    const pool = await getDbPool();
    try {
      const query = monthYear
        ? `
          SELECT
            SUM(TotalAmount) AS TotalRevenue,
            COUNT(*) AS TransactionCount,
            AVG(TotalAmount) AS AvgTransaction
          FROM [Payment]
          WHERE CONVERT(VARCHAR(7), PaymentTime, 121) = @monthYear
        `
        : `
          SELECT
            SUM(TotalAmount) AS TotalRevenue,
            COUNT(*) AS TransactionCount,
            AVG(TotalAmount) AS AvgTransaction
          FROM [Payment]
        `;
      const request = pool.request();
      if (monthYear) request.input("monthYear", monthYear);
      const result = await request.query(query);
      return result.recordset[0];
    } catch (error) {
      console.error("❌ Error fetching revenue report:", error);
      throw new Error("Error fetching revenue report");
    }
  }

  // ⚡ Báo cáo sử dụng trạm sạc
  async getUsageReport(monthYear?: string): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const query = monthYear
        ? `
          SELECT
            s.StationName,
            COUNT(*) AS SessionCount,
            SUM(DATEDIFF(MINUTE, cs.CheckinTime, cs.CheckoutTime)) AS TotalMinutes,
            AVG(cs.SessionPrice) AS AvgPrice
          FROM [ChargingSession] cs
            JOIN [Station] s ON cs.StationId = s.StationId
          WHERE CONVERT(VARCHAR(7), cs.CheckinTime, 121) = @monthYear
          GROUP BY s.StationName
        `
        : `
          SELECT
            s.StationName,
            COUNT(*) AS SessionCount,
            SUM(DATEDIFF(MINUTE, cs.CheckinTime, cs.CheckoutTime)) AS TotalMinutes,
            AVG(cs.SessionPrice) AS AvgPrice
          FROM [ChargingSession] cs
            JOIN [Station] s ON cs.StationId = s.StationId
          GROUP BY s.StationName
        `;
      const request = pool.request();
      if (monthYear) request.input("monthYear", monthYear);
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error("❌ Error fetching usage report:", error);
      throw new Error("Error fetching usage report");
    }
  }

  // 📊 Dashboard tổng quan
  async getDashboardStats(): Promise<any> {
    const pool = await getDbPool();
    try {
      const totalUsers = await pool.request().query(`SELECT COUNT(*) AS count FROM [User]`);
      const totalStaff = await pool
        .request()
        .query(`SELECT COUNT(*) AS count FROM [User] WHERE RoleName = 'STAFF'`);
      const totalBusiness = await pool
        .request()
        .query(`SELECT COUNT(*) AS count FROM [User] WHERE RoleName = 'BUSINESS'`);
      const totalStations = await pool.request().query(`SELECT COUNT(*) AS count FROM [Station]`);
      const totalSessions = await pool
        .request()
        .query(`SELECT COUNT(*) AS count FROM [ChargingSession]`);
      const totalRevenue = await pool
        .request()
        .query(`SELECT ISNULL(SUM(TotalAmount), 0) AS total FROM [Payment]`);

      return {
        totalUsers: totalUsers.recordset[0].count,
        totalStaff: totalStaff.recordset[0].count,
        totalBusiness: totalBusiness.recordset[0].count,
        totalStations: totalStations.recordset[0].count,
        totalSessions: totalSessions.recordset[0].count,
        totalRevenue: totalRevenue.recordset[0].total || 0,
      };
    } catch (error) {
      console.error("❌ Error fetching dashboard stats:", error);
      throw new Error("Error fetching dashboard stats");
    }
  }

  // 👨‍💼 Tạo tài khoản Staff mới
  async createStaff(mail: string, userName: string, password: string, address: string): Promise<any> {
    const pool = await getDbPool();
    try {
      const passwordHash = await bcrypt.hash(password, 10)
      console.log("📨 createStaff() nhận:", { mail, userName, password });

      const check = await pool
        .request()
        .input("mail", mail)
        .query(`SELECT COUNT(*) AS count FROM [User] WHERE [Mail] = @mail`);

      if (check.recordset[0].count > 0) {
        return { success: false, message: "Email đã tồn tại!" };
      }
      const hashed = await bcrypt.hash(password, 10);
      const station = await pool
        .request()
        .input("address", address)
        .query(`SELECT StationId FROM [Station] WHERE Address = @address`);

      const insert = await pool
        .request()
        .input("mail", mail)
        .input("userName", userName)
        .input("password", hashed)
        .input("stationId", station.recordset[0]?.StationId || null)
        .query(`
          INSERT INTO [User] ([Mail], [UserName], [PassWord], [RoleName], [StationId])
          VALUES (@mail, @userName, @password, 'STAFF', @stationId);
          SELECT SCOPE_IDENTITY() AS UserId;
        `);
      

      const newUserId = insert.recordset[0].UserId;

      return {
        success: true,
        data: { UserId: newUserId, Mail: mail, UserName: userName, RoleName: "STAFF" },
        message: "Staff created successfully",
      };
    } catch (error: any) {
      console.error("❌ Lỗi khi tạo staff:", error.message);
      return { success: false, message: "Lỗi khi tạo tài khoản Staff!" };
    }
  }

  // 👥 Lấy danh sách Staff
  async getAllStaff(): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const result = await pool.request().query(`
        SELECT
          UserId,
          Mail,
          UserName,
          Status
        FROM [User]
        WHERE RoleName = 'STAFF'
        ORDER BY UserId DESC;
      `);
      return result.recordset;
    } catch (error) {
      throw new Error("Error fetching staff users");
    }
  }
  async createStation(stationName: string, address: string, stationStatus: "ACTIVE" | "MAINTENANCE" | "FULL", stationDescrip: string | null, chargingPointTotal: number
): Promise<any> {
  
  const pool = await getDbPool();
  try {
    const result = await pool.request()
      .input("StationName", stationName)
      .input("Address", address)
      .input("StationStatus", stationStatus)
      .input("StationDescrip", stationDescrip)
      .input("ChargingPointTotal", chargingPointTotal)
      .query(`
        INSERT INTO [Station] (StationName, Address, StationStatus, StationDescrip, ChargingPointTotal)
        VALUES (@StationName, @Address, @StationStatus, @StationDescrip, @ChargingPointTotal);

        SELECT @@IDENTITY AS StationId;
      `);

    return result.recordset[0];
  } catch (error) {
    throw new Error("Error creating station: " + error);
  }
}

  async deleteStationById(stationId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool.request()
        .input("StationId", stationId)
        .query(`
          DELETE FROM [Station]
          WHERE StationId = @StationId
        `)
    } catch (error) {
      throw new Error("Error deleting station: " + error)
    }
  }
  async createPoint(stationId: number, numberOfPort: number ): Promise<any> {
    const pool = await getDbPool()
    try {
      const chargingPointStatus: string = 'AVAILABLE'
      const result = await pool.request()
        .input("StationId", stationId)
        .input("ChargingPointStatus", chargingPointStatus)
        .input("NumberOfPort", numberOfPort)
        .query(`
          INSERT INTO [ChargingPoint] (StationId, ChargingPointStatus, NumberOfPort)
          VALUES (@StationId, @ChargingPointStatus, @NumberOfPort);
          SELECT @@IDENTITY as PointId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error creating charging point: " + error)
    }
  }
  async updatePoint(pointId: number, numberOfPort?: number, chargingPointStatus?: string): Promise<void> {
    const pool = await getDbPool()
    try {
      const updateFields = []
      const request = pool.request().input("PointId", pointId)

      if (numberOfPort !== undefined) {
        updateFields.push("NumberOfPort = @NumberOfPort")
        request.input("NumberOfPort", numberOfPort)
      }
      if (chargingPointStatus !== undefined) {
        updateFields.push("ChargingPointStatus = @ChargingPointStatus")
        request.input("ChargingPointStatus", chargingPointStatus)
      }

      if (updateFields.length === 0) {
        throw new Error("No fields to update")
      }

      const query = `UPDATE [ChargingPoint] SET ${updateFields.join(", ")} WHERE PointId = @PointId`
      await request.query(query)
    } catch (error) {
      throw new Error("Error updating charging point: " + error)
    }
  }

  async deletePointById(pointId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool.request()
        .input("PointId", pointId)
        .query(`
          DELETE FROM [ChargingPoint]
          WHERE PointId = @PointId
        `)
    } catch (error) {
      throw new Error("Error deleting charging point: " + error)
    }
  }
  async createPort(pointId: number, portName: string, portType: string, portTypeOfKwh: number, portTypePrice: number, portStatus: string = 'AVAILABLE'): Promise<any> {
    const pool = await getDbPool()
    try {
      // Validate portType against allowed values
      const validPortTypes = ['J1772', 'CHAdeMO', 'CCS', 'Type 2 (Mennekes)']
      if (!validPortTypes.includes(portType)) {
        throw new Error(`Invalid PortType. Allowed values: ${validPortTypes.join(", ")}`)
      }

      // Validate portStatus against allowed values
      const validPortStatuses = ['AVAILABLE', 'IN_USE', 'FAULTY']
      if (!validPortStatuses.includes(portStatus)) {
        throw new Error(`Invalid PortStatus. Allowed values: ${validPortStatuses.join(", ")}`)
      }

      const result = await pool.request()
        .input("PointId", pointId)
        .input("PortName", portName)
        .input("PortType", portType)
        .input("ChargingPortType", portType)
        .input("PortTypeOfKwh", portTypeOfKwh)
        .input("PortTypePrice", portTypePrice)
        .input("PortStatus", portStatus)
        .query(`
          INSERT INTO [ChargingPort] (PointId, PortName, PortType, ChargingPortType, PortTypeOfKwh, PortTypePrice, PortStatus)
          VALUES (@PointId, @PortName, @PortType, @ChargingPortType, @PortTypeOfKwh, @PortTypePrice, @PortStatus);
          SELECT @@IDENTITY as PortId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error creating charging port: " + error)
    }
  }
  async updatePort(portId: number, portName?: string, portType?: string, chargingPortType?: string, portTypeOfKwh?: number, portTypePrice?: number, portStatus?: string): Promise<void> {
    const pool = await getDbPool()
    try {
      const updateFields = []
      const request = pool.request().input("PortId", portId)

      if (portName !== undefined) {
        updateFields.push("PortName = @PortName")
        request.input("PortName", portName)
      }
      if (portType !== undefined) {
        const validPortTypes = ['J1772', 'CHAdeMO', 'CCS', 'Type 2 (Mennekes)'] 
        if (!validPortTypes.includes(portType)) {
          throw new Error(`Invalid PortType. Allowed values: ${validPortTypes.join(", ")}`)
        }
        updateFields.push("PortType = @PortType")
        request.input("PortType", portType)
      }
      if (chargingPortType !== undefined) {
        const validPortTypes = ['AC', 'DC']
        if (!validPortTypes.includes(chargingPortType)) {
          throw new Error(`Invalid ChargingPortType. Allowed values: ${validPortTypes.join(", ")}`)
        }
        updateFields.push("ChargingPortType = @ChargingPortType")
        request.input("ChargingPortType", chargingPortType)
      }
      if (portTypeOfKwh !== undefined) {
        updateFields.push("PortTypeOfKwh = @PortTypeOfKwh")
        request.input("PortTypeOfKwh", portTypeOfKwh)
      }
      if (portTypePrice !== undefined) {
        updateFields.push("PortTypePrice = @PortTypePrice")
        request.input("PortTypePrice", portTypePrice)
      }
      if (portStatus !== undefined) {
        const validPortStatuses = ['AVAILABLE', 'IN_USE', 'FAULTY']
        if (!validPortStatuses.includes(portStatus)) {
          throw new Error(`Invalid PortStatus. Allowed values: ${validPortStatuses.join(", ")}`)
        }
        updateFields.push("PortStatus = @PortStatus")
        request.input("PortStatus", portStatus)
      }

      if (updateFields.length === 0) {
        throw new Error("No fields to update")
      }

      const query = `UPDATE [ChargingPort] SET ${updateFields.join(", ")} WHERE PortId = @PortId`
      await request.query(query)
    } catch (error) {
      throw new Error("Error updating charging port: " + error)
    }
  }
  async deletePortById(portId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool.request()
        .input("PortId", portId)
        .query(`
          DELETE FROM [ChargingPort]
          WHERE PortId = @PortId
        `)
    } catch (error) {
      throw new Error("Error deleting charging port: " + error)
    }
  }

  // 🛠️ Admin cập nhật hồ sơ bản thân
  async updateAdminProfile(
    userId: number,
    data: { UserName?: string; Mail?: string; PassWord?: string }
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      // Lấy hiện trạng
      const existing = await pool
        .request()
        .input("UserId", userId)
        .query(`SELECT UserId, UserName, Mail, PassWord, RoleName FROM [User] WHERE UserId = @UserId`)

      if (!existing.recordset[0]) {
        throw new Error("User not found")
      }

      const current = existing.recordset[0]
      const nextUserName = data.UserName ?? current.UserName
      const nextMail = data.Mail ?? current.Mail

      if (data.Mail) {
        if (!validateEmail(data.Mail)) {
          throw new Error("Invalid email format")
        }
        // Check unique email for other users
        const dup = await pool
          .request()
          .input("Mail", data.Mail)
          .input("UserId", userId)
          .query(`SELECT COUNT(*) AS C FROM [User] WHERE Mail = @Mail AND UserId <> @UserId`)
        if (dup.recordset[0]?.C > 0) {
          throw new Error("Email already in use")
        }
      }

      let nextPasswordHash = current.PassWord
      if (data.PassWord) {
        nextPasswordHash = await bcrypt.hash(data.PassWord, 10)
      }

      const result = await pool
        .request()
        .input("UserId", userId)
        .input("UserName", nextUserName)
        .input("Mail", nextMail)
        .input("PassWord", nextPasswordHash)
        .query(`
          UPDATE [User]
          SET UserName = @UserName,
              Mail = @Mail,
              PassWord = @PassWord
          OUTPUT INSERTED.UserId, INSERTED.UserName, INSERTED.Mail, INSERTED.RoleName
          WHERE UserId = @UserId
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error("Error updating profile: " + error)
    }
  }

  // 🗑️ Xóa người dùng và toàn bộ dữ liệu phụ thuộc (transactional)
  async deleteUserCascading(targetUserId: number): Promise<void> {
    const pool = await getDbPool()
    const tx = new sql.Transaction(pool)
    try {
      // Kiểm tra user tồn tại và không phải ADMIN
      const userRs = await pool
        .request()
        .input("UserId", targetUserId)
        .query(`SELECT UserId, RoleName FROM [User] WHERE UserId = @UserId`)

      const userRow = userRs.recordset[0]
      if (!userRow) {
        throw new Error("User not found")
      }
      if (String(userRow.RoleName).toUpperCase() === "ADMIN") {
        throw new Error("Cannot delete an ADMIN user")
      }

      await tx.begin()
      const req = new sql.Request(tx)
      req.input("UserId", targetUserId)

      // 1) Refresh tokens
      await req.query(`DELETE FROM [RefreshToken] WHERE UserId = @UserId`)

      // 2) Payments directly by user
      await req.query(`DELETE FROM [Payment] WHERE UserId = @UserId`)

      // 3) Payments via user's invoices
      await req.query(`
        DELETE P
        FROM [Payment] P
        WHERE P.InvoiceId IN (SELECT InvoiceId FROM [Invoice] WHERE UserId = @UserId)
      `)

      // 4) Payments via user's sessions (by vehicle or booking)
      await req.query(`
        DELETE P
        FROM [Payment] P
        WHERE P.SessionId IN (
          SELECT cs.SessionId
          FROM [ChargingSession] cs
          WHERE cs.VehicleId IN (SELECT VehicleId FROM [Vehicle] WHERE UserId = @UserId)
             OR cs.BookingId IN (SELECT BookingId FROM [Booking] WHERE UserId = @UserId)
        )
      `)

      // 5) Invoices of user
      await req.query(`DELETE FROM [Invoice] WHERE UserId = @UserId`)

      // 6) Charging sessions of user's vehicles or bookings
      await req.query(`
        DELETE cs
        FROM [ChargingSession] cs
        WHERE cs.VehicleId IN (SELECT VehicleId FROM [Vehicle] WHERE UserId = @UserId)
           OR cs.BookingId IN (SELECT BookingId FROM [Booking] WHERE UserId = @UserId)
      `)

      // 7) Bookings of user
      await req.query(`DELETE FROM [Booking] WHERE UserId = @UserId`)

      // 8) Subscriptions of user
      await req.query(`DELETE FROM [Subscription] WHERE UserId = @UserId`)

      // 9) Vehicles of user
      await req.query(`DELETE FROM [Vehicle] WHERE UserId = @UserId`)

      // 10) Finally, the user
      await req.query(`DELETE FROM [User] WHERE UserId = @UserId`)

      await tx.commit()
    } catch (error) {
      try { await tx.rollback() } catch {}
      throw new Error("Error deleting user: " + error)
    }
  }
}

export const adminService = new AdminService();
