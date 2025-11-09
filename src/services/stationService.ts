import { getDbPool } from "../config/database"

export class StationService {
  async getAllStations(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT * FROM [Station]
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching all stations")
    }
  }

async getStationInfor(address: string): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input("address", address). query(`
        SELECT * FROM [Station] WHERE Address = @address
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching all stations")
    }
  }
  async getStationById(stationId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("stationId", stationId)
        .query(`
          SELECT * FROM [Station] WHERE StationId = @stationId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching station")
    }
  }

  async getStationChargingPoints(stationId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("stationId", stationId)
        .query(`
          SELECT * FROM [ChargingPoint] WHERE StationId = @stationId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching charging points")
    }
  }

  async getChargingPointPorts(pointId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("pointId", pointId)
        .query(`
          SELECT * FROM [ChargingPort] WHERE PointId = @pointId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching charging ports")
    }
  }

  async getPortStatus(portId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("portId", portId)
        .query(`
          SELECT * FROM [ChargingPort] WHERE PortId = @portId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching port status")
    }
  }

  async updatePortStatus(portId: number, status: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("portId", portId)
        .input("status", status)
        .query(`
          UPDATE [ChargingPort] SET PortStatus = @status WHERE PortId = @portId
        `)
    } catch (error) {
      throw new Error("Error updating port status")
    }
  }

  async createStation(
    stationName: string,
    address: string,
    stationDescrip: string,
    chargingPointTotal: number,
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("stationName", stationName)
        .input("address", address)
        .input("stationDescrip", stationDescrip)
        .input("chargingPointTotal", chargingPointTotal)
        .input("stationStatus", "ACTIVE")
        .query(`
          INSERT INTO [Station] (StationName, Address, StationDescrip, ChargingPointTotal, StationStatus)
          OUTPUT INSERTED.StationId
          VALUES (@stationName, @address, @stationDescrip, @chargingPointTotal, @stationStatus)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error creating station")
    }
  }

  async updateStation(stationId: number, stationName: string, address: string, stationDescrip: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("stationId", stationId)
        .input("stationName", stationName)
        .input("address", address)
        .input("stationDescrip", stationDescrip)
        .query(`
          UPDATE [Station]
          SET StationName = @stationName, Address = @address, StationDescrip = @stationDescrip
          WHERE StationId = @stationId
        `)
    } catch (error) {
      throw new Error("Error updating station")
    }
  }

  async deleteStation(stationId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("stationId", stationId)
        .query(`
          DELETE FROM [Station] WHERE StationId = @stationId
        `)
    } catch (error) {
      throw new Error("Error deleting station")
    }
  }
  
  async getPointsByStation(stationId: number): Promise<any[]> {
  const pool = await getDbPool()
  try {
    const result = await pool.request()
      .input("StationId", stationId)
      .query(`
        SELECT PointId, StationId, ChargingPointStatus, NumberOfPort
        FROM [ChargingPoint]
        WHERE StationId = @StationId
      `)
    return result.recordset
  } catch (error) {
    throw new Error("Error fetching points for station: " + error)
  }

}
  async getPortByPoint(pointId: number): Promise<any[]> {
  const pool = await getDbPool()
  try {
    const result = await pool.request()
      .input("PointId", pointId)
      .query(`
        SELECT PortId, PointId, PortType, PortStatus
        FROM [ChargingPort]
        WHERE PointId = @PointId
      `)
    return result.recordset
  } catch (error) {
    throw new Error("Error fetching ports for point: " + error)
  }
}
  async getPortById(portId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("portId", portId)
        .query(`
          SELECT * FROM [ChargingPort] WHERE PortId = @portId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching port by ID")
    }
  }
}

export const stationService = new StationService()
