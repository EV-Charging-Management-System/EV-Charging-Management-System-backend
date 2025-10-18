import bcrypt from 'bcrypt'
import { getDbPool } from '../config/database'
import jwt from 'jsonwebtoken'
import { config } from '../config/config'

// Interface payload token
export interface Payload {
  userId: number
  email: string
  role: string
}

// Thời gian hết hạn token
const ACCESS_TOKEN_EXPIRES_IN = '1m'
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000 // 7 ngày (ms)

// Hàm đăng ký user
export const register = async (
  Email: string,
  Password: string,
  ConfirmPassword: string,
  FullName: string
) => {
  const passwordRegex = /^.{6,12}$/
  if (!passwordRegex.test(Password)) {
    throw new Error('Mật khẩu phải từ 6 đến 12 ký tự')
  }

  if (Password !== ConfirmPassword) {
    throw new Error('Mật khẩu không trùng khớp')
  }

  const pool = await getDbPool()

  // Kiểm tra email tồn tại
  const existing = await pool.request().input('email', Email).query(`
    SELECT Mail FROM [User] WHERE Mail = @email
  `)

  if (existing.recordset.length > 0) {
    throw new Error('Email đã tồn tại')
  }

  // Lấy RoleId cho "Driver"
  const roleRes = await pool.request().input('name', 'Driver').query(`
    SELECT RoleId FROM [Role] WHERE RoleName = @name
  `)

  if (roleRes.recordset.length === 0) {
    throw new Error('Role không tồn tại')
  }

  const role = roleRes.recordset[0]

  // Mã hóa mật khẩu
  const passwordHash = await bcrypt.hash(Password, 10)

  // Thêm user mới
  await pool
    .request()
    .input('email', Email)
    .input('password', passwordHash)
    .input('roleName', role.RoleName)
    .input('fullname', FullName)
    .query(`
      INSERT INTO [User] (Mail, PassWord, RoleName, UserName)
      VALUES (@email, @password, @roleName, @fullname)
    `)

  // Lấy lại user vừa tạo
  const newUser = await pool.request().input('email', Email).query(`
    SELECT UserId, Mail, RoleName, UserName FROM [User] WHERE Mail = @email
  `)

  return newUser.recordset[0]
}

// Hàm đăng nhập
export const login = async (email: string, password: string) => {
  const pool = await getDbPool()

  const result = await pool.request().input('email', email).query(`
    SELECT UserId, Mail, PassWord, RoleName
    FROM [User]
    WHERE Mail = @email
  `)

  if (result.recordset.length === 0) return null

  const user = result.recordset[0]

  const valid = await bcrypt.compare(password, user.PassWord)
  if (!valid) return null

  const payload: Payload = {
    userId: user.UserId,
    email: user.Mail,
    role: user.role.RoleName
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = await generateRefreshToken(payload)

  return { accessToken, refreshToken, payload }
}

// Tạo Access Token
export const generateAccessToken = (payload: Payload): string => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
}

// Tạo Refresh Token và lưu vào DB
export const generateRefreshToken = async (payload: Payload): Promise<string> => {
  const pool = await getDbPool()

  const refreshToken = jwt.sign(payload, config.jwt.secret, { expiresIn: `${REFRESH_TOKEN_EXPIRES_IN / 1000}s` })
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN)

  try {
    await pool
      .request()
      .input('token', refreshToken)
      .input('userId', payload.userId) // Lưu đúng userId
      .input('expiresAt', expiresAt)
      .query(`
        INSERT INTO RefreshToken (Token, UserId, ExpiresAt, Revoked)
        VALUES (@token, @userId, @expiresAt, 0)
      `)
  } catch (error) {
    throw new Error('Error saving refresh token to the database')
  }

  return refreshToken
}

// Xác minh Refresh Token
export const verifyRefreshToken = async (
  refreshToken: string
): Promise<{ userId: number; email: string; role: string } | null> => {
  const pool = await getDbPool()

  try {
    const result = await pool
      .request()
      .input('token', refreshToken)
      .query('SELECT TOP 1 * FROM RefreshToken WHERE Token = @token AND Revoked = 0')

    if (result.recordset.length === 0) return null

    const tokenRecord = result.recordset[0]

    if (new Date(tokenRecord.ExpiresAt) < new Date()) return null

    const decoded = jwt.verify(refreshToken, config.jwt.secret) as Payload

    const userResult = await pool.request().input('userId', decoded.userId).query(`
      SELECT Mail, RoleName FROM [User] WHERE UserId = @userId
    `)

    if (userResult.recordset.length === 0) return null

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    }
  } catch (error) {
    console.error('Error verifying refresh token:', error)
    return null
  }
}

// Thu hồi Refresh Token
export const revokeRefreshToken = async (token: string): Promise<void> => {
  const pool = await getDbPool()

  try {
    await pool.request().input('token', token).query('UPDATE RefreshToken SET Revoked = 1 WHERE Token = @token')
  } catch (error) {
    throw new Error('Error revoking refresh token')
  }
}

// Đổi mật khẩu
export const PasswordChange = async (userId: number, password: string, newPassword: string) => {
  const pool = await getDbPool()

  const Result = await pool
    .request()
    .input('userId', userId)
    .query('SELECT PassWord, Mail FROM [User] WHERE UserId = @userId')

  if (Result.recordset.length === 0) {
    throw new Error('Account not found')
  }

  const user = Result.recordset[0]

  const match = await bcrypt.compare(password, user.PassWord)
  if (!match) {
    throw new Error('Mật khẩu cũ không đúng')
  }

  const passwordregex = /^.{6,12}$/
  if (!passwordregex.test(newPassword)) {
    throw new Error('Mật khẩu mới phải từ 6 đến 12 ký tự')
  }

  if (password === newPassword) {
    throw new Error('Mật khẩu mới không được trùng mật khẩu cũ')
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10)

  try {
    await pool
      .request()
      .input('userId', userId)
      .input('newPasswordHash', newPasswordHash)
      .query('UPDATE [User] SET PassWord = @newPasswordHash WHERE UserId = @userId')

    return { message: 'Password change is successful' }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error('Error updating password: ' + error.message)
    } else {
      throw new Error('Error updating password: Unknown error')
    }
  }
}
