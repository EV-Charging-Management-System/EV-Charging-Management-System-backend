import { getDbPool } from "../config/database"

export class MembershipService {
  async getPackages(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT * FROM [Package] ORDER BY PackagePrice
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching packages")
    }
  }

  async getPackageById(packageId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("packageId", packageId)
        .query(`
          SELECT * FROM [Package] WHERE PackageId = @packageId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching package")
    }
  }

  async createPackage(packageName: string, packageDescrip: string, packagePrice: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("packageName", packageName)
        .input("packageDescrip", packageDescrip)
        .input("packagePrice", packagePrice)
        .query(`
          INSERT INTO [Package] (PackageName, PackageDescrip, PackagePrice)
          OUTPUT INSERTED.PackageId
          VALUES (@packageName, @packageDescrip, @packagePrice)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error creating package")
    }
  }

  async updatePackage(
    packageId: number,
    packageName: string,
    packageDescrip: string,
    packagePrice: number,
  ): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("packageId", packageId)
        .input("packageName", packageName)
        .input("packageDescrip", packageDescrip)
        .input("packagePrice", packagePrice)
        .query(`
          UPDATE [Package]
          SET PackageName = @packageName, PackageDescrip = @packageDescrip, PackagePrice = @packagePrice
          WHERE PackageId = @packageId
        `)
    } catch (error) {
      throw new Error("Error updating package")
    }
  }

  async deletePackage(packageId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("packageId", packageId)
        .query(`
          DELETE FROM [Package] WHERE PackageId = @packageId
        `)
    } catch (error) {
      throw new Error("Error deleting package")
    }
  }

  async purchaseSubscription(userId: number, companyId: number | null, packageId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const startDate = new Date()
      const startMonth = startDate.toISOString().substring(0, 7)

      const result = await pool
        .request()
        .input("userId", userId)
        .input("companyId", companyId || 0)
        .input("packageId", packageId)
        .input("startMonth", startMonth)
        .input("startDate", startDate)
        .input("durationMonth", "1")
        .query(`
          INSERT INTO [Subcription] (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth)
          OUTPUT INSERTED.SubcriptionId
          VALUES (@userId, @companyId, @packageId, @startMonth, @startDate, @durationMonth)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error purchasing subscription")
    }
  }

  async getUserSubscription(userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("userId", userId)
        .query(`
          SELECT 
            s.*,
            p.PackageName,
            p.PackagePrice,
            p.PackageDescrip
          FROM [Subcription] s
          LEFT JOIN [Package] p ON s.PackageId = p.PackageId
          WHERE s.UserId = @userId
          ORDER BY s.StartDate DESC
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching user subscription")
    }
  }

  async getCompanySubscription(companyId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("companyId", companyId)
        .query(`
          SELECT 
            s.*,
            p.PackageName,
            p.PackagePrice,
            p.PackageDescrip
          FROM [Subcription] s
          LEFT JOIN [Package] p ON s.PackageId = p.PackageId
          WHERE s.CompanyId = @companyId
          ORDER BY s.StartDate DESC
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching company subscription")
    }
  }

  async renewSubscription(subscriptionId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      const startDate = new Date()
      const startMonth = startDate.toISOString().substring(0, 7)

      await pool
        .request()
        .input("subscriptionId", subscriptionId)
        .input("startDate", startDate)
        .input("startMonth", startMonth)
        .query(`
          UPDATE [Subcription]
          SET StartDate = @startDate, StartMonth = @startMonth
          WHERE SubcriptionId = @subscriptionId
        `)
    } catch (error) {
      throw new Error("Error renewing subscription")
    }
  }

  async cancelSubscription(subscriptionId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("subscriptionId", subscriptionId)
        .query(`
          DELETE FROM [Subcription] WHERE SubcriptionId = @subscriptionId
        `)
    } catch (error) {
      throw new Error("Error canceling subscription")
    }
  }

  async checkSubscriptionDiscount(userId: number, companyId: number | null): Promise<number> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("userId", userId)
        .input("companyId", companyId || 0)
        .query(`
          SELECT COUNT(*) as Count FROM [Subcription]
          WHERE (UserId = @userId OR CompanyId = @companyId)
          AND DATEDIFF(MONTH, StartDate, GETDATE()) < 1
        `)
      return result.recordset[0].Count > 0 ? 20 : 0
    } catch (error) {
      throw new Error("Error checking subscription discount")
    }
  }
}

export const membershipService = new MembershipService()
