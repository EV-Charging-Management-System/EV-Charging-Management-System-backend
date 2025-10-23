import { NVarChar, Int, Float } from 'mssql'
import { getDbPool } from '../config/database'

class PackageService {
  async getAllPackages(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`SELECT * FROM [Package]`)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching packages: ' + error)
    }
  }

  async getPackageById(id: number): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('PackageId', Int, id).query(`SELECT * FROM [Package] WHERE PackageId = @PackageId`)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error fetching package: ' + error)
    }
  }

  async createPackage(data: { PackageName: string; PackageDescrip?: string; PackagePrice?: number }): Promise<any> {
    const pool = await getDbPool()
    try {
      const { PackageName, PackageDescrip = null, PackagePrice = 0 } = data
      const result = await pool
        .request()
        .input('PackageName', NVarChar(100), PackageName)
        .input('PackageDescrip', NVarChar(200), PackageDescrip)
        .input('PackagePrice', Float, PackagePrice)
        .query(`
          INSERT INTO [Package] (PackageName, PackageDescrip, PackagePrice)
          OUTPUT INSERTED.*
          VALUES (@PackageName, @PackageDescrip, @PackagePrice)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error('Error creating package: ' + error)
    }
  }

  async updatePackage(id: number, data: { PackageName?: string; PackageDescrip?: string; PackagePrice?: number }): Promise<any> {
    const pool = await getDbPool()
    try {
      const existing = await this.getPackageById(id)
      if (!existing) return null

      const PackageName = data.PackageName ?? existing.PackageName
      const PackageDescrip = data.PackageDescrip ?? existing.PackageDescrip
      const PackagePrice = data.PackagePrice ?? existing.PackagePrice

      const result = await pool
        .request()
        .input('PackageId', Int, id)
        .input('PackageName', NVarChar(100), PackageName)
        .input('PackageDescrip', NVarChar(200), PackageDescrip)
        .input('PackagePrice', Float, PackagePrice)
        .query(`
          UPDATE [Package]
          SET PackageName = @PackageName, PackageDescrip = @PackageDescrip, PackagePrice = @PackagePrice
          OUTPUT INSERTED.*
          WHERE PackageId = @PackageId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error('Error updating package: ' + error)
    }
  }

  async deletePackage(id: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('PackageId', Int, id).query(`DELETE FROM [Package] WHERE PackageId = @PackageId`)
      return result.rowsAffected[0] > 0
    } catch (error) {
      throw new Error('Error deleting package: ' + error)
    }
  }
}

export const packageService = new PackageService()
