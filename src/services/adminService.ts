import { getDbPool } from "../config/database";
import bcrypt from "bcryptjs";

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
}

export const adminService = new AdminService();
