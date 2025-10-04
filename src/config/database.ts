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
    if (pool) {
      return
    }

    pool = await new sql.ConnectionPool(dbConfig).connect()
    console.log('Database connected successfully')
  } catch (error) {
    console.error('Database connection failed:', error)
    throw error
  }
}

export const getDbPool = async (): Promise<sql.ConnectionPool> => {
  if (!pool) {
    await connectToDatabase()
  }
  return pool!
}

export const closeDbPool = async (): Promise<void> => {
  if (pool) {
    await pool.close()
    pool = null
    console.log('Database connection closed')
  }
}

export const createDefaultAdmin = async (): Promise<void> => {
  try {
    const dbPool = await getDbPool()

    // Check if admin already exists
    const existingAdmin = await dbPool
      .request()
      .input('email', config.admin.email)
      .query('SELECT AccountID FROM Accounts WHERE Email = @email')

    if (existingAdmin.recordset.length > 0) {
      console.log('Default admin account already exists')
      return
    }

    // Hash the default admin password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(config.admin.password, saltRounds)

    // Create admin account
    const accountResult = await dbPool
      .request()
      .input('email', config.admin.email)
      .input('passwordHash', hashedPassword)
      .input('roleId', 1).query(`
        INSERT INTO Accounts (Email, PasswordHash, RoleID, CreatedAt)
        VALUES (@email, @passwordHash, @roleId, GETDATE())
      `)
    const select = await dbPool
      .request()
      .input('email', config.admin.email)
      .query('SELECT * FROM Accounts WHERE Email = @email')

    const accountId = select.recordset[0].AccountID

    // Create admin profile
    await dbPool.request().input('accountId', accountId).input('fullName', 'System Administrator').query(`
        INSERT INTO UserProfiles (AccountID, FullName, CreatedAt, UpdatedAt)
        VALUES (@accountId, @fullName, GETDATE(), GETDATE())
      `)

    console.log('Default admin account created successfully')
  } catch (error) {
    console.error('Failed to create default admin account:', error)
    throw error
  }
}
