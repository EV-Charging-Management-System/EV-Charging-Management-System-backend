import { getDbPool } from '../config/database'
import { Int, NVarChar, Float } from 'mssql'

export interface PackageDTO {
  PackageId: number
  PackageName: string
  PackageDescrip: string | null
  PackagePrice: number
}

export interface CreatePackageInput {
  PackageName: string
  PackageDescrip?: string | null
  PackagePrice: number
}

export interface UpdatePackageInput extends CreatePackageInput {
  PackageId: number
}

class PackageService {
  async getAll(): Promise<PackageDTO[]> {
    const pool = await getDbPool()
    const result = await pool.request().query<PackageDTO>(
      'SELECT PackageId, PackageName, PackageDescrip, PackagePrice FROM [Package] ORDER BY PackageId DESC'
    )
    return result.recordset
  }

  async getById(id: number): Promise<PackageDTO | null> {
    const pool = await getDbPool()
    const result = await pool
      .request()
      .input('id', Int, id)
      .query<PackageDTO>('SELECT PackageId, PackageName, PackageDescrip, PackagePrice FROM [Package] WHERE PackageId = @id')
    return result.recordset[0] || null
  }

  async create(input: CreatePackageInput): Promise<PackageDTO> {
    const pool = await getDbPool()
    const insert = await pool
      .request()
      .input('name', NVarChar(100), input.PackageName)
      .input('descrip', NVarChar(200), input.PackageDescrip ?? null)
      .input('price', Float, input.PackagePrice)
      .query('INSERT INTO [Package] (PackageName, PackageDescrip, PackagePrice) VALUES (@name, @descrip, @price); SELECT SCOPE_IDENTITY() AS id')
    const id = Number(insert.recordset[0].id)
    return (await this.getById(id)) as PackageDTO
  }

  async update(input: UpdatePackageInput): Promise<PackageDTO | null> {
    const pool = await getDbPool()
    await pool
      .request()
      .input('id', Int, input.PackageId)
      .input('name', NVarChar(100), input.PackageName)
      .input('descrip', NVarChar(200), input.PackageDescrip ?? null)
      .input('price', Float, input.PackagePrice)
      .query('UPDATE [Package] SET PackageName = @name, PackageDescrip = @descrip, PackagePrice = @price WHERE PackageId = @id')
    return this.getById(input.PackageId)
  }

  async remove(id: number): Promise<boolean> {
    const pool = await getDbPool()
    const result = await pool.request().input('id', Int, id).query('DELETE FROM [Package] WHERE PackageId = @id')
    return result.rowsAffected[0] > 0
  }
}

export const packageService = new PackageService()
