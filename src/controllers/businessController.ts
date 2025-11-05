import type { AuthRequest } from "../middlewares/authMiddleware";
import type { NextFunction, Response } from "express";
import { getDbPool } from "../config/database";
import { Int, NVarChar } from "mssql";

export class BusinessController {
  // 🟢 Gửi yêu cầu nâng cấp tài khoản doanh nghiệp
  async requestUpgrade(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
<<<<<<< Updated upstream
      const userId = req.user?.userId; // ✅ Lấy từ token, giống adminController
=======
      const userId = req.user?.userId; // ✅ Lấy từ token
>>>>>>> Stashed changes
      if (!userId) {
        res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập!" });
        return;
      }

      const pool = await getDbPool();

      // 🔹 Kiểm tra người dùng có tồn tại
      const check = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`SELECT * FROM [User] WHERE UserId = @UserId`);

      const user = check.recordset[0];
      if (!user) {
        res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
        return;
      }

      // 🔹 Kiểm tra trạng thái hiện tại
      if (user.RoleName === "BUSINESS") {
        res.status(400).json({ success: false, message: "Tài khoản này đã là doanh nghiệp!" });
        return;
      }

<<<<<<< Updated upstream
      if (user.RoleName === "PENDING_BUSINESS") {
=======
      if (user.Status === "PENDING") {
>>>>>>> Stashed changes
        res.status(400).json({ success: false, message: "Yêu cầu nâng cấp đang chờ duyệt!" });
        return;
      }

<<<<<<< Updated upstream
      // 🔹 Cập nhật RoleName sang chờ duyệt
      await pool
        .request()
        .input("UserId", Int, userId)
        .input("RoleName", NVarChar(50), "PENDING_BUSINESS")
        .query(`
          UPDATE [User]
          SET RoleName = @RoleName
=======
      // 🔹 Cập nhật trạng thái sang chờ duyệt (thay vì đổi RoleName)
      await pool
        .request()
        .input("UserId", Int, userId)
        .input("Status", NVarChar(20), "PENDING")
        .query(`
          UPDATE [User]
          SET Status = @Status
>>>>>>> Stashed changes
          WHERE UserId = @UserId
        `);

      res.status(200).json({
        success: true,
        message: "🎯 Đã gửi yêu cầu nâng cấp doanh nghiệp. Vui lòng chờ admin duyệt.",
      });
    } catch (error) {
      console.error("❌ Lỗi trong requestUpgrade:", error);
      next(error);
    }
  }

<<<<<<< Updated upstream
  // 🟣 (Tuỳ chọn) Lấy thông tin doanh nghiệp hiện tại
=======
  // 🟣 Lấy thông tin doanh nghiệp hiện tại
>>>>>>> Stashed changes
  async getBusinessProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập!" });
        return;
      }

      const pool = await getDbPool();
      const result = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
<<<<<<< Updated upstream
          SELECT 
=======
          SELECT
>>>>>>> Stashed changes
            u.UserId,
            u.UserName,
            u.Mail,
            u.RoleName,
<<<<<<< Updated upstream
=======
            u.Status, -- ✅ thêm cột Status
>>>>>>> Stashed changes
            c.CompanyId,
            c.CompanyName,
            c.Address,
            c.Phone,
            c.Mail AS CompanyMail
          FROM [User] u
<<<<<<< Updated upstream
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
=======
            LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
>>>>>>> Stashed changes
          WHERE u.UserId = @UserId
        `);

      const info = result.recordset[0];
      if (!info) {
        res.status(404).json({ success: false, message: "Không tìm thấy thông tin doanh nghiệp!" });
        return;
      }

      res.status(200).json({ success: true, data: info });
    } catch (error) {
      console.error("❌ Lỗi trong getBusinessProfile:", error);
      next(error);
    }
  }
}

export const businessController = new BusinessController();
