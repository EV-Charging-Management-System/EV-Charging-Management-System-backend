import type { Response, Request } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  register,
  login,
  verifyRefreshToken,
  generateAccessToken,
  PasswordChange
  // forgotPassword,
  // resetPassword
} from '../services/authService'
import { getDbPool } from '../config/database'

export const registerHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { Email, PasswordHash, ConfirmPassword, FullName } = req.body
 
  // Kiểm tra các tham số đầu vào
  if (!Email || !PasswordHash || !ConfirmPassword) {
    res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' })
    return
  }
  const passwordregex = /^.{6,12}$/
  if (!passwordregex.test(PasswordHash)) {
    res.status(400).json({ message: 'Mật khẩu phải có độ dài từ 6 đến 12 ký tự' })
    return
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/
  if (!emailRegex.test(Email)) {
    res.status(400).json({ message: 'Email không hợp lệ' })
    return
  }
  try {
    const user = await register(
      Email,
      PasswordHash,
      ConfirmPassword,
      FullName
    )
    if (!user) {
      res.status(409).json({ message: 'Email đã tồn tại' })
      return
    }

    res.status(201).json({ message: 'Đăng ký thành công', success: true })
  } catch (error: unknown) {
    console.log(error)

    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

export const loginHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { Email, PasswordHash } = req.body

  if (!Email || !PasswordHash) {
    res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' })
    return
  }

  try {
    const tokens = await login(Email, PasswordHash)
    if (!tokens) {
      res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ' })
      return
    }

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      success: true,
      user: tokens.payload
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(Error)

      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

export const PasswordChangeHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user
  if (!user) {
    res.status(401).json({ message: 'Không có quyền truy cập' })
    return
  }
  const { password, NewPassword, confirmNewPassword } = req.body

  // Kiểm tra mật khẩu cũ và mật khẩu mới
  if (!password) {
    res.status(400).json({ message: 'Mật khẩu cũ là bắt buộc' })
    return
  }
  if (!NewPassword) {
    res.status(400).json({ message: 'Mật khẩu mới là bắt buộc' })
    return
  }
  if (NewPassword !== confirmNewPassword) {
    res.status(400).json({ message: 'Mật khẩu không trùng khớp' })
    return
  }

  try {
    await PasswordChange(user.userId, password, NewPassword)
    res.json({ message: 'Yêu cầu thay đổi mật khẩu đã thành công' })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

export const refreshAccessTokenHandler = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(400).json({ message: 'Thiếu refresh token' })
    return
  }

  try {
    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) {
      res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' })
      return
    }

    // Đảm bảo bạn truyền đầy đủ thông tin trong payload
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    })

    res.json({ accessToken: newAccessToken })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

// Add the missing getCurrentUserInfo endpoint
export const getCurrentUserInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Không có quyền truy cập' })
      return
    }

    // Get additional user information from database if needed
    const pool = await getDbPool()
    const result = await pool.request().input('userId', user.userId).query(`
    SELECT 
      UserId AS userId,
      Mail AS email,
      RoleName AS role,
      UserName AS fullName
    FROM [User]
    WHERE UserId = @userId
  `)

    if (result.recordset.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' })
      return
    }

    const userInfo = result.recordset[0]
    res.json({ success: true, user: userInfo })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

// Add logout handler
export const logoutHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.user?.userId

    // Revoke the refresh token in the database
    const pool = await getDbPool()
    await pool.request().input('id', id).query(`
        DELETE FROM RefreshToken WHERE UserId = @id
      `)

    res.json({ success: true, message: 'Đăng xuất thành công' })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

// export const forgotPasswordHandler = async (req: Request, res: Response): Promise<void> => {
//   const { email } = req.body

//   if (!email) {
//     res.status(400).json({ message: 'Email is required' })
//     return
//   }

//   const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/
//   if (!emailRegex.test(email)) {
//     res.status(400).json({ message: 'Invalid email format' })
//     return
//   }

//   try {
//     const result = await forgotPassword(email)
//     res.json({ success: true, message: result.message })
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       if (error.message === 'Email not found') {
//         res.status(404).json({ message: 'Email not found' })
//       } else {
//         res.status(500).json({ message: error.message })
//       }
//     } else {
//       res.status(500).json({ message: 'An unknown error occurred' })
//     }
//   }
// }

// export const resetPasswordHandler = async (req: Request, res: Response): Promise<void> => {
//   const { token, newPassword, confirmPassword } = req.body

//   if (!token || !newPassword || !confirmPassword) {
//     res.status(400).json({ message: 'Token, new password, and confirm password are required' })
//     return
//   }

//   if (newPassword !== confirmPassword) {
//     res.status(400).json({ message: 'Passwords do not match' })
//     return
//   }

//   try {
//     const result = await resetPassword(token, newPassword)
//     res.json({ success: true, message: result.message })
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       if (error.message === 'Invalid or expired reset token') {
//         res.status(400).json({ message: 'Invalid or expired reset token' })
//       } else if (error.message === 'Password must be between 6 and 12 characters') {
//         res.status(400).json({ message: 'Password must be between 6 and 12 characters' })
//       } else {
//         res.status(500).json({ message: error.message })
//       }
//     } else {
//       res.status(500).json({ message: 'An unknown error occurred' })
//     }
//   }
// }
