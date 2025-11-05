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
          u.Status,
          c.CompanyName,
          c.Address,
          c.Phone,
          c.Mail AS CompanyMail
        FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.Status = 'PENDING'
        ORDER BY u.UserId DESC;
      `);
      return result.recordset;
    } catch (error) {
      console.error("❌ Error fetching pending approvals:", error);
      throw new Error("Error fetching pending approvals");
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
          SET
            RoleName = 'BUSINESS',
            Status = 'APPROVED'
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
      await pool
        .request()
        .input("userId", userId)
        .query(`
          UPDATE [User]
          SET Status = 'REJECTED'
          WHERE UserId = @userId;
        `);
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
        SELECT UserId, Mail, UserName, RoleName, CompanyId, Status
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
  async createStaff(mail: string, userName: string, password: string): Promise<any> {
    const pool = await getDbPool();
    try {
      console.log("📨 createStaff() nhận:", { mail, userName, password });

      const check = await pool
        .request()
        .input("mail", mail)
        .query(`SELECT COUNT(*) AS count FROM [User] WHERE [Mail] = @mail`);

      if (check.recordset[0].count > 0) {
        return { success: false, message: "Email đã tồn tại!" };
      }

      const hashed = await bcrypt.hash(password, 10);

      const insert = await pool
        .request()
        .input("mail", mail)
        .input("userName", userName)
        .input("password", hashed)
        .query(`
          INSERT INTO [User] ([Mail], [UserName], [PassWord], [RoleName], [Status])
          VALUES (@mail, @userName, @password, 'STAFF', 'ACTIVE');
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
}

export const adminService = new AdminService();
