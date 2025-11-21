import { getDbPool } from "../config/database"
import { randomInt } from "crypto"

export class VehicleService {
  async getVehicles(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT * FROM [Vehicle] WHERE UserId = @UserId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching vehicles")
    }
  }

  async getVehicleById(vehicleId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("VehicleId", vehicleId)
        .query(`
          SELECT * FROM [Vehicle] WHERE VehicleId = @VehicleId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching vehicle")
    }
  }

  async addVehicle(
    userId: number,
    vehicleName: string,
    vehicleType: string,
    licensePlate: string,
    battery?: number,
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      const randomBattery = battery || randomInt(20, 100)

      // Load user to determine CompanyId when role = BUSINESS
      const userRow = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT TOP 1 UserId, Role, CompanyId FROM [User] WHERE UserId = @UserId
        `)

      const userInfo = userRow.recordset[0]
      const companyIdToUse = userInfo && userInfo.Role === "BUSINESS" ? userInfo.CompanyId ?? null : null

      const insert = await pool
        .request()
        .input("UserId", userId)
        .input("VehicleName", vehicleName)
        .input("VehicleType", vehicleType)
        .input("LicensePlate", licensePlate)
        .input("Battery", randomBattery)
        .input("CompanyId", companyIdToUse)
        .query(`
          INSERT INTO [Vehicle] (UserId, VehicleName, VehicleType, LicensePlate, Battery, CompanyId)
          OUTPUT INSERTED.VehicleId, INSERTED.CompanyId
          VALUES (@UserId, @VehicleName, @VehicleType, @LicensePlate, @Battery, @CompanyId)
        `)

      return {
        vehicleId: insert.recordset[0].VehicleId,
        vehicleName,
        licensePlate,
        battery: randomBattery,
        companyId: insert.recordset[0].CompanyId ?? null,
      }
    } catch (error) {
      throw new Error("Error adding vehicle: " + error)
    }
  }

  async registerByPlate(params: {
    userId: number
    role?: string
    licensePlate: string
    vehicleName?: string
    vehicleType?: string
    battery?: number
  }): Promise<
    | { status: "created"; vehicle: any }
    | { status: "updated"; vehicle: any }
    | { status: "exists-other-user"; vehicle?: any }
    | { status: "attached-company"; vehicle: any }
  > {
    const pool = await getDbPool()
    const plate = params.licensePlate
    try {
      // Load current user info (role + company)
      const userRow = await pool
        .request()
        .input("UserId", params.userId)
        .query(`
          SELECT TOP 1 UserId, Role, CompanyId FROM [User] WHERE UserId = @UserId
        `)
      const userInfo = userRow.recordset[0]
      const isBusiness = userInfo?.Role === "BUSINESS"
      const businessCompanyId = isBusiness ? userInfo.CompanyId ?? null : null

      // Find existing vehicle by plate
      const existing = await pool
        .request()
        .input("LicensePlate", plate)
        .query(`
          SELECT TOP 1 * FROM [Vehicle] WHERE LicensePlate = @LicensePlate
        `)

      if (!existing.recordset[0]) {
        // Create new vehicle
        const randomBattery = params.battery || randomInt(20, 100)
        const insertResult = await pool
          .request()
          .input("UserId", params.userId)
          .input("VehicleName", params.vehicleName || null)
          .input("VehicleType", params.vehicleType || null)
          .input("LicensePlate", plate)
          .input("Battery", randomBattery)
          .input("CompanyId", businessCompanyId)
          .query(`
            INSERT INTO [Vehicle] (UserId, VehicleName, VehicleType, LicensePlate, Battery, CompanyId)
            OUTPUT INSERTED.VehicleId
            VALUES (@UserId, @VehicleName, @VehicleType, @LicensePlate, @Battery, @CompanyId)
          `)

        const newId = insertResult.recordset[0].VehicleId

        // load with user/company info
        const info = await pool
          .request()
          .input("VehicleId", newId)
          .query(`
            SELECT v.VehicleId, v.UserId, u.CompanyId, v.VehicleName, v.VehicleType, v.LicensePlate, v.Battery
            FROM [Vehicle] v
            JOIN [User] u ON v.UserId = u.UserId
            WHERE v.VehicleId = @VehicleId
          `)

        return { status: "created", vehicle: mapVehicle(info.recordset[0]) }
      }

      const found = existing.recordset[0]
      if (Number(found.UserId) !== Number(params.userId)) {
        // Business can attach existing personal vehicle (CompanyId null -> set; otherwise keep)
        if (isBusiness) {
          if (!found.CompanyId && businessCompanyId) {
            await pool
              .request()
              .input("VehicleId", found.VehicleId)
              .input("CompanyId", businessCompanyId)
              .query(`
                UPDATE [Vehicle] SET CompanyId = @CompanyId WHERE VehicleId = @VehicleId
              `)
            // refresh
            const refreshed = await pool
              .request()
              .input("VehicleId", found.VehicleId)
              .query(`
                SELECT v.VehicleId, v.UserId, COALESCE(v.CompanyId, u.CompanyId) AS CompanyId, v.VehicleName, v.VehicleType, v.LicensePlate, v.Battery
                FROM [Vehicle] v
                JOIN [User] u ON v.UserId = u.UserId
                WHERE v.VehicleId = @VehicleId
              `)
            return { status: "attached-company", vehicle: mapVehicle(refreshed.recordset[0]) }
          }
          // Already has a company or cannot attach -> just return existing without error
          const existingInfo = await pool
            .request()
            .input("VehicleId", found.VehicleId)
            .query(`
              SELECT v.VehicleId, v.UserId, COALESCE(v.CompanyId, u.CompanyId) AS CompanyId, v.VehicleName, v.VehicleType, v.LicensePlate, v.Battery
              FROM [Vehicle] v
              JOIN [User] u ON v.UserId = u.UserId
              WHERE v.VehicleId = @VehicleId
            `)
          return { status: "attached-company", vehicle: mapVehicle(existingInfo.recordset[0]) }
        }
        return { status: "exists-other-user" }
      }

      // Update owned vehicle with provided fields (if any)
      const newName = params.vehicleName ?? found.VehicleName
      const newType = params.vehicleType ?? found.VehicleType
      const newBattery = params.battery ?? found.Battery

      await pool
        .request()
        .input("VehicleId", found.VehicleId)
        .input("VehicleName", newName)
        .input("VehicleType", newType)
        .input("Battery", newBattery)
        .query(`
          UPDATE [Vehicle]
          SET VehicleName = @VehicleName, VehicleType = @VehicleType, Battery = @Battery
          WHERE VehicleId = @VehicleId
        `)

      const updated = await pool
        .request()
        .input("VehicleId", found.VehicleId)
        .query(`
          SELECT v.VehicleId, v.UserId, u.CompanyId, v.VehicleName, v.VehicleType, v.LicensePlate, v.Battery
          FROM [Vehicle] v
          JOIN [User] u ON v.UserId = u.UserId
          WHERE v.VehicleId = @VehicleId
        `)

      return { status: "updated", vehicle: mapVehicle(updated.recordset[0]) }
    } catch (error) {
      throw new Error("Error registering vehicle by plate: " + error)
    }
  }

  async updateVehicle(
    vehicleId: number,
    vehicleName: string,
    vehicleType: string,
    licensePlate: string,
  ): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("VehicleId", vehicleId)
        .input("VehicleName", vehicleName)
        .input("VehicleType", vehicleType)
        .input("LicensePlate", licensePlate)
        .query(`
          UPDATE [Vehicle]
          SET VehicleName = @VehicleName, VehicleType = @VehicleType, LicensePlate = @LicensePlate
          WHERE VehicleId = @VehicleId
        `)
    } catch (error) {
      throw new Error("Error updating vehicle")
    }
  }

  async deleteVehicle(vehicleId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("VehicleId", vehicleId)
        .query(`
          DELETE FROM [Vehicle] WHERE VehicleId = @VehicleId
        `)
    } catch (error) {
      throw new Error("Error deleting vehicle")
    }
  }

  async getCompanyByLicensePlate(licensePlate: string): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("LicensePlate", licensePlate)
        .query(`
          SELECT TOP 1
            v.VehicleId,
            v.LicensePlate,
            v.Battery AS Battery,
          u.UserName,
            u.UserId,
            COALESCE(v.CompanyId, u.CompanyId) AS CompanyId,
            COALESCE(cv.CompanyName, cu.CompanyName) AS CompanyName
          FROM [Vehicle] v
          JOIN [User] u ON v.UserId = u.UserId
          LEFT JOIN [Company] cv ON v.CompanyId = cv.CompanyId
          LEFT JOIN [Company] cu ON u.CompanyId = cu.CompanyId
          WHERE v.LicensePlate = @LicensePlate
        `)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error("Error looking up company by license plate")
    }
  }
}

export const vehicleService = new VehicleService()

// Helper to shape vehicle response
function mapVehicle(row: any) {
  if (!row) return null
  return {
    vehicleId: row.VehicleId,
    userId: row.UserId,
    companyId: row.CompanyId ?? null,
    vehicleName: row.VehicleName ?? null,
    vehicleType: row.VehicleType ?? null,
    licensePlate: row.LicensePlate,
    battery: row.Battery,
  }
}
