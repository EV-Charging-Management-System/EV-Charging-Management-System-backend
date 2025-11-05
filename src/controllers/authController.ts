import type { Response, Request } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware";
import {
  register,
  registerBusiness,
  login,
  verifyRefreshToken,
  generateAccessToken,
  PasswordChange,
} from "../services/authService";
import { getDbPool } from "../config/database";

// 🔹 Đăng ký người dùng thường
export const registerHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { Email, PasswordHash, ConfirmPassword, FullName } = req.body;

  if (!Email || !PasswordHash || !ConfirmPassword) {
    res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    return;
  }

  const passwordregex = /^.{6,12}$/;
  if (!passwordregex.test(PasswordHash)) {
    res.status(400).json({ message: "Mật khẩu phải có độ dài từ 6 đến 12 ký tự" });
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(Email)) {
    res.status(400).json({ message: "Email không hợp lệ" });
    return;
  }

  try {
    const user = await register(Email, PasswordHash, ConfirmPassword, FullName);
    if (!user) {
      res.status(409).json({ message: "Email đã tồn tại" });
      return;
    }

    res.status(201).json({ message: "Đăng ký thành công", success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Lỗi hệ thống" });
  }
};

// 🔹 Đăng ký doanh nghiệp
export const registerBusinessHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { Email, PasswordHash, ConfirmPassword, CompanyName, Address, Phone } = req.body;

  if (!Email || !PasswordHash || !ConfirmPassword || !CompanyName || !Address || !Phone) {
    res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    return;
  }

  const passwordregex = /^.{6,12}$/;
  if (!passwordregex.test(PasswordHash)) {
    res.status(400).json({ message: "Mật khẩu phải có độ dài từ 6 đến 12 ký tự" });
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(Email)) {
    res.status(400).json({ message: "Email không hợp lệ" });
    return;
  }

  try {
    const user = await registerBusiness(Email, PasswordHash, ConfirmPassword, CompanyName, Address, Phone);
    if (!user) {
      res.status(409).json({ message: "Email đã tồn tại" });
      return;
    }

    res.status(201).json({ message: "Đăng ký doanh nghiệp thành công, chờ admin duyệt", success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Đã xảy ra lỗi hệ thống" });
  }
};

// 🔹 Đăng nhập
export const loginHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { Email, PasswordHash } = req.body;
  if (!Email || !PasswordHash) {
    res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    return;
  }

  try {
    const tokens = await login(Email, PasswordHash);
    if (!tokens) {
      res.status(401).json({ message: "Thông tin đăng nhập không hợp lệ" });
      return;
    }

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      success: true,
      user: tokens.payload,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Đăng nhập thất bại" });
  }
};

// 🔹 Đổi mật khẩu
export const PasswordChangeHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: "Không có quyền truy cập" });
    return;
  }

  const { password, NewPassword, confirmNewPassword } = req.body;
  if (!password || !NewPassword || !confirmNewPassword) {
    res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
    return;
  }

  if (NewPassword !== confirmNewPassword) {
    res.status(400).json({ message: "Mật khẩu không trùng khớp" });
    return;
  }

  try {
    await PasswordChange(user.userId, password, NewPassword);
    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Lỗi hệ thống" });
  }
};

// 🔹 Làm mới access token
export const refreshAccessTokenHandler = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ message: "Thiếu refresh token" });
    return;
  }

  try {
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      res.status(401).json({ message: "Refresh token không hợp lệ hoặc đã hết hạn" });
      return;
    }

    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    res.json({ accessToken: newAccessToken });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Không thể làm mới token" });
  }
};

// 🔹 Lấy thông tin user hiện tại (thêm isPremium)
export const getCurrentUserInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Không có quyền truy cập" });
      return;
    }

    const pool = await getDbPool();
    const result = await pool.request()
      .input("userId", user.userId)
      .query(`
        SELECT
          u.UserId AS userId,
          u.Mail AS email,
          u.RoleName AS role,
          u.UserName AS fullName,
          u.CompanyId AS companyId,
          CASE WHEN EXISTS (
            SELECT 1
            FROM Subscription s
            WHERE s.UserId = u.UserId
              AND s.SubStatus = 'ACTIVE'
              AND DATEADD(
                    month,
                    TRY_CONVERT(int, s.DurationMonth),
                    TRY_CONVERT(date, s.StartDate)
                  ) >= CONVERT(date, GETDATE())
          ) THEN 1 ELSE 0 END AS isPremium
        FROM [User] u
        WHERE u.UserId = @userId
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
      return;
    }

    res.json({ success: true, user: result.recordset[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Không thể lấy thông tin người dùng" });
  }
};

// 🔹 Đăng xuất
export const logoutHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.user?.userId;
    const pool = await getDbPool();
    await pool.request().input("id", id).query(`DELETE FROM RefreshToken WHERE UserId = @id`);

    res.json({ success: true, message: "Đăng xuất thành công" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Đã xảy ra lỗi khi đăng xuất" });
  }
};
