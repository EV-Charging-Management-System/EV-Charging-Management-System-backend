import sql from 'mssql'
import bcrypt from 'bcryptjs'
import { config } from './config'

let pool: sql.ConnectionPool | null = null

const dbConfig: sql.config = {
  server: config.database.server,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  port: config.database.port,
  options: {
    encrypt: config.database.encrypt,
    trustServerCertificate: config.database.trustServerCertificate,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
}

export const connectToDatabase = async (): Promise<void> => {
  try {
    if (pool) return
    pool = await new sql.ConnectionPool(dbConfig).connect()
    console.log('✅ Database connected successfully')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}

export const getDbPool = async (): Promise<sql.ConnectionPool> => {
  if (!pool) await connectToDatabase()
  return pool!
}

export const closeDbPool = async (): Promise<void> => {
  if (pool) {
    await pool.close()
    pool = null
    console.log('🛑 Database connection closed')
  }
}

export const createDefaultAdmin = async (): Promise<void> => {
  try {
    const dbPool = await getDbPool()

    // Kiểm tra admin tồn tại chưa
    const existingAdmin = await dbPool
      .request()
      .input('email', sql.VarChar, config.admin.email)
      .query('SELECT UserId FROM [User] WHERE Mail = @email')

    if (existingAdmin.recordset.length > 0) {
      console.log('⚠️ Default admin already exists')
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(config.admin.password, 12)

    // Tạo admin
    await dbPool
      .request()
      .input('email',  config.admin.email)
      .input('passwordHash',  hashedPassword)
      .input('roleId',  1)
      .input('UserName',  'System Administrator')
      .query(`
        INSERT INTO [User] (Mail, PassWord, UserName, RoleId)
        VALUES (@email, @passwordHash, @UserName, @roleId)
      `)

    console.log('✅ Default admin created successfully')
  } catch (error) {
    console.error('❌ Failed to create default admin:', error)
    throw error
  }
}
