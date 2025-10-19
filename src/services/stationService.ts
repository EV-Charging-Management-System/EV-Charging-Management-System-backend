import { NVarChar } from 'mssql';
import { getDbPool } from '../config/database'
import type { User, Service, DashboardStats } from '../types/type'

class StationService {
 async getStationInfor(StationAddress: string): Promise<void> {
    const pool = await getDbPool();
    try {
        // Get station information from database
        const result = await pool.request().input('StationAddress', NVarChar, StationAddress).query(`
        SELECT * FROM [Station] WHERE Address = @StationAddress
        `);
        return result.recordset[0];
    } catch (error) {
        throw new Error('Error fetching station information from the database');
    }   
}
getAllStations = async (): Promise<any[]> => {
    const pool = await getDbPool();
    try {
        const result = await pool.request().query(`
        SELECT * FROM [Station]
        `);
        return result.recordset;
    } catch (error) {
        throw new Error('Error fetching all stations from the database');
    }
}
getMaybe = async (): Promise<any[]> => {
    const pool = await getDbPool();
    try {
        const result = await pool.request().query(`
        SELECT * FROM Station
        `);
        return result.recordset;
    } catch (error) {
        throw new Error('Error fetching all stations from the database');
    }
}
}
export const stationService = new StationService()
