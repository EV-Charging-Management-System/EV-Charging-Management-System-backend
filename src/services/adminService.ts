import { getDbPool } from "../config/database"

export class AdminService {
  async getPendingBusinessApprovals(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT 
          u.UserId,
          u.Mail,
          u.UserName,
          c.CompanyId,
          c.CompanyName,
          c.Address,
          c.Phone,
          c.Mail as CompanyMail
        FROM [User] u
        JOIN [Company] c ON u.CompanyId = c.CompanyId
        WHERE u.RoleName = 'BUSINESS'
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching pending approvals")
    }
  }

  async approveBusiness(userId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("userId", userId)
        .query(`
          UPDATE [User] SET RoleName = 'BUSINESS' WHERE UserId = @userId
        `)
    } catch (error) {
      throw new Error("Error approving business")
    }
  }

  async rejectBusiness(userId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("userId", userId)
        .query(`
          DELETE FROM [User] WHERE UserId = @userId
        `)
    } catch (error) {
      throw new Error("Error rejecting business")
    }
  }

  async getAllUsers(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT 
          UserId,
          Mail,
          UserName,
          RoleName,
          CompanyId
        FROM [User]
        ORDER BY UserId DESC
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching users")
    }
  }

  async getUserById(userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("userId", userId)
        .query(`
          SELECT * FROM [User] WHERE UserId = @userId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching user")
    }
  }

  async updateUserRole(userId: number, role: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("userId", userId)
        .input("role", role)
        .query(`
          UPDATE [User] SET RoleName = @role WHERE UserId = @userId
        `)
    } catch (error) {
      throw new Error("Error updating user role")
    }
  }

  async getRevenueReport(monthYear?: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const query = monthYear
        ? `
          SELECT 
            SUM(TotalAmount) as TotalRevenue,
            COUNT(*) as TransactionCount,
            AVG(TotalAmount) as AvgTransaction
          FROM [Payment]
          WHERE CONVERT(VARCHAR(7), PaymentTime, 121) = @monthYear
        `
        : `
          SELECT 
            SUM(TotalAmount) as TotalRevenue,
            COUNT(*) as TransactionCount,
            AVG(TotalAmount) as AvgTransaction
          FROM [Payment]
        `

      const request = pool.request()
      if (monthYear) {
        request.input("monthYear", monthYear)
      }

      const result = await request.query(query)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching revenue report")
    }
  }

  async getUsageReport(monthYear?: string): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const query = monthYear
        ? `
          SELECT 
            s.StationName,
            COUNT(*) as SessionCount,
            SUM(DATEDIFF(MINUTE, cs.CheckinTime, cs.CheckoutTime)) as TotalMinutes,
            AVG(cs.SessionPrice) as AvgPrice
          FROM [ChargingSession] cs
          JOIN [Station] s ON cs.StationId = s.StationId
          WHERE CONVERT(VARCHAR(7), cs.CheckinTime, 121) = @monthYear
          GROUP BY s.StationName
        `
        : `
          SELECT 
            s.StationName,
            COUNT(*) as SessionCount,
            SUM(DATEDIFF(MINUTE, cs.CheckinTime, cs.CheckoutTime)) as TotalMinutes,
            AVG(cs.SessionPrice) as AvgPrice
          FROM [ChargingSession] cs
          JOIN [Station] s ON cs.StationId = s.StationId
          GROUP BY s.StationName
        `

      const request = pool.request()
      if (monthYear) {
        request.input("monthYear", monthYear)
      }

      const result = await request.query(query)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching usage report")
    }
  }

  async getDashboardStats(): Promise<any> {
    const pool = await getDbPool()
    try {
      const totalUsers = await pool.request().query(`SELECT COUNT(*) as count FROM [User]`)
      const totalStations = await pool.request().query(`SELECT COUNT(*) as count FROM [Station]`)
      const totalSessions = await pool.request().query(`SELECT COUNT(*) as count FROM [ChargingSession]`)
      const totalRevenue = await pool.request().query(`SELECT SUM(TotalAmount) as total FROM [Payment]`)

      return {
        totalUsers: totalUsers.recordset[0].count,
        totalStations: totalStations.recordset[0].count,
        totalSessions: totalSessions.recordset[0].count,
        totalRevenue: totalRevenue.recordset[0].total || 0,
      }
    } catch (error) {
      throw new Error("Error fetching dashboard stats")
    }
  }
  async createStaff(mail: string, userName: string, password: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("mail", mail)
        .input("userName", userName)
        .input("password", password)
        .query(`
          INSERT INTO [User] (Mail, UserName, Password, RoleName)
          VALUES (@mail, @userName, @password, 'STAFF')
        `)
        const us = await pool
        .request()
        .input("mail", mail)
        .query(`
          SELECT UserId FROM [User] WHERE Mail = @mail
        `)
       return us.recordset[0];
      
    } catch (error) {
      throw new Error("Error creating staff user")
    } 
    
  }
  async getAllStaff(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT 
          UserId,
          Mail,
          UserName
        FROM [User]
        WHERE RoleName = 'STAFF'
        ORDER BY UserId DESC
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching staff users")
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
  async createPoint(stationId: number, pointName: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool.request()
        .input("StationId", stationId)
        .input("PointName", pointName)
        .query(`
          INSERT INTO [ChargingPoint] (StationId, PointName)
          VALUES (@StationId, @PointName)
        `)
    } catch (error) {
      throw new Error("Error creating charging point: " + error)
    }
  }
  async updatePoint(pointId: number, pointName: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool.request()
        .input("PointId", pointId)
        .input("PointName", pointName)
        .query(`
          UPDATE [ChargingPoint]
          SET PointName = @PointName
          WHERE PointId = @PointId
        `)
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
}

export const adminService = new AdminService()
