import { NVarChar, DateTime, Int } from "mssql"
import { getDbPool } from "../config/database"

class MembershipService {
  async getMembershipPackages(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT * FROM [MembershipPackage] ORDER BY Duration
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching membership packages")
    }
  }

  async purchaseMembership(userId: number, packageId: number, paymentMethod: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const membershipId = `MEM_${Date.now()}`
      const startDate = new Date()
      const endDate = new Date()

      // Get package details
      const packageResult = await pool
        .request()
        .input("PackageId", Int, packageId)
        .query(`SELECT * FROM [MembershipPackage] WHERE PackageId = @PackageId`)

      const pkg = packageResult.recordset[0]
      if (!pkg) throw new Error("Package not found")

      // Calculate end date based on duration
      endDate.setMonth(endDate.getMonth() + pkg.Duration)

      const result = await pool
        .request()
        .input("MembershipId", NVarChar, membershipId)
        .input("UserId", Int, userId)
        .input("PackageId", Int, packageId)
        .input("StartDate", DateTime, startDate)
        .input("EndDate", DateTime, endDate)
        .input("Status", NVarChar, "ACTIVE")
        .input("CreatedAt", DateTime, new Date())
        .query(`
          INSERT INTO [Membership] (MembershipId, UserId, PackageId, StartDate, EndDate, Status, CreatedAt)
          VALUES (@MembershipId, @UserId, @PackageId, @StartDate, @EndDate, @Status, @CreatedAt)
        `)

      return { membershipId, startDate, endDate, status: "ACTIVE" }
    } catch (error) {
      throw new Error("Error purchasing membership")
    }
  }

  async getUserMembership(userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT m.*, mp.PackageName, mp.Price, mp.Duration 
          FROM [Membership] m
          LEFT JOIN [MembershipPackage] mp ON m.PackageId = mp.PackageId
          WHERE m.UserId = @UserId AND m.Status = 'ACTIVE'
          ORDER BY m.StartDate DESC
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching user membership")
    }
  }

  async checkMembershipValidity(userId: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", Int, userId)
        .input("CurrentDate", DateTime, new Date())
        .query(`
          SELECT COUNT(*) as Count FROM [Membership] 
          WHERE UserId = @UserId AND Status = 'ACTIVE' AND EndDate > @CurrentDate
        `)
      return result.recordset[0].Count > 0
    } catch (error) {
      throw new Error("Error checking membership validity")
    }
  }
}

export const membershipService = new MembershipService()
