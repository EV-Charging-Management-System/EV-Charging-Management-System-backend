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

    // Lấy RoleId cho Admin
    const adminRole = await dbPool
      .request()
      .input('roleName', 'Admin')
      .query('SELECT TOP 1 RoleId FROM [Role] WHERE RoleName = @roleName')

    if (adminRole.recordset.length === 0) {
      throw new Error("Role 'Admin' không tồn tại. Hãy gọi ensureRolesExist trước.")
    }

    const adminRoleId = adminRole.recordset[0].RoleId

    // Hash password
    const hashedPassword = await bcrypt.hash(config.admin.password, 12)
    // Lấy roleName từ config nếu có, fallback 'ADMIN'
    const roleName = (config.admin.roleName as string) || 'ADMIN'
    // Tạo admin
    await dbPool
      .request()
<<<<<<< HEAD
      .input('email', config.admin.email)
      .input('passwordHash', hashedPassword)
      .input('roleId', adminRoleId)
      .input('UserName', 'System Administrator')
=======
      .input('email', sql.NVarChar(100), config.admin.email)
      .input('passwordHash', sql.NVarChar(100), hashedPassword)
      .input('roleName', sql.NVarChar(50), roleName)
      .input('UserName', sql.NVarChar(100), 'System Administrator')
>>>>>>> origin/main
      .query(`
        INSERT INTO [User] (Mail, PassWord, UserName, RoleName)
        VALUES (@email, @passwordHash, @UserName, @roleName)
      `)

    console.log('✅ Default admin created successfully')
  } catch (error) {
    console.error('❌ Failed to create default admin:', error)
    throw error
  }
}

// Đảm bảo các Role cơ bản tồn tại
export const ensureRolesExist = async (): Promise<void> => {
  const dbPool = await getDbPool()
  const requiredRoles = ['Admin', 'Driver']

  for (const roleName of requiredRoles) {
    const exists = await dbPool
      .request()
      .input('roleName', roleName)
      .query('SELECT TOP 1 RoleId FROM [Role] WHERE RoleName = @roleName')

    if (exists.recordset.length === 0) {
      await dbPool
        .request()
        .input('roleName', roleName)
        .query('INSERT INTO [Role] (RoleName) VALUES (@roleName)')
      console.log(`✅ Created missing role: ${roleName}`)
    }
  }
}
