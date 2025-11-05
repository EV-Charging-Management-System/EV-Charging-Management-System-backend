<<<<<<< Updated upstream
import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { adminService } from "../services/adminService"

export class AdminController {
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats()
      res.status(200).json({ success: true, data: stats })
    } catch (error) {
      next(error)
    }
  }

  async getPendingApprovals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const approvals = await adminService.getPendingBusinessApprovals()
      res.status(200).json({ success: true, data: approvals })
    } catch (error) {
      next(error)
    }
  }

  async approveBusiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await adminService.approveBusiness(Number(id))
      res.json({ success: true, message: "Business approved successfully" })
    } catch (error) {
      next(error)
    }
  }

  async rejectBusiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await adminService.rejectBusiness(Number(id))
      res.json({ success: true, message: "Business rejected successfully" })
    } catch (error) {
      next(error)
    }
  }

  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await adminService.getAllUsers()
      res.status(200).json({ success: true, data: users })
    } catch (error) {
      next(error)
    }
  }

  async getUserById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const user = await adminService.getUserById(Number(id))
      if (!user) {
        res.status(404).json({ message: "User not found" })
        return
      }
      res.status(200).json({ success: true, data: user })
    } catch (error) {
      next(error)
    }
  }

  async updateUserRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { role } = req.body

      if (!role) {
        res.status(400).json({ message: "Role is required" })
        return
      }

      await adminService.updateUserRole(Number(id), role)
      res.json({ success: true, message: "User role updated successfully" })
    } catch (error) {
      next(error)
    }
  }

  async getRevenueReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { monthYear } = req.query
      const report = await adminService.getRevenueReport(monthYear as string)
      res.status(200).json({ success: true, data: report })
    } catch (error) {
      next(error)
    }
  }

  async getUsageReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { monthYear } = req.query
      const report = await adminService.getUsageReport(monthYear as string)
      res.status(200).json({ success: true, data: report })
    } catch (error) {
      next(error)
    }
  }
  async createStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { Email, PasswordHash, FullName } = req.body  
      if (!Email || !PasswordHash || !FullName) {
        res.status(400).json({ message: "All fields are required" })
        return
      }
      const newStaff = await adminService.createStaff( Email,  FullName ,PasswordHash)
      res.status(201).json({ success: true, data: newStaff, message: "Staff created successfully" })
    } catch (error) {
      next(error)
    }
  }
  async getAllStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffList = await adminService.getAllStaff()
      res.status(200).json({ success: true, data: staffList })
    } catch (error) {
      next(error)
    }
  }
}


export const adminController = new AdminController()
=======
import type { AuthRequest } from "../middlewares/authMiddleware";
import type { NextFunction, Response } from "express";
import { adminService } from "../services/adminService";

export class AdminController {
  // 📊 Dashboard thống kê
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // ⚙️ Tạm trả về dữ liệu giả nếu chưa có service
      const stats = await adminService.getDashboardStats?.();
      res.status(200).json({
        success: true,
        data: stats || {
          totalUsers: 0,
          totalStations: 0,
          totalBookings: 0,
          totalRevenue: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 🏢 Lấy danh sách doanh nghiệp chờ duyệt
  async getPendingBusinessApprovals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const approvals = await adminService.getPendingBusinessApprovals();
      res.status(200).json({
        success: true,
        message: "Fetched pending business approvals successfully",
        data: approvals,
      });
    } catch (error) {
      next(error);
    }
  }

  // ✅ Duyệt tài khoản doanh nghiệp
  async approveBusiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await adminService.approveBusiness(Number(id));
      res.json({ success: true, message: "✅ Business approved successfully" });
    } catch (error) {
      next(error);
    }
  }

  // ❌ Từ chối doanh nghiệp
  async rejectBusiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await adminService.rejectBusiness(Number(id));
      res.json({ success: true, message: "❌ Business rejected successfully" });
    } catch (error) {
      next(error);
    }
  }

  // 👥 Lấy danh sách tất cả người dùng
  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await adminService.getAllUsers();
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  // 🔍 Lấy người dùng theo ID
  async getUserById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await adminService.getUserById(Number(id));
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  // 🔄 Cập nhật vai trò người dùng
  async updateUserRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;
      if (!role) {
        res.status(400).json({ success: false, message: "Role is required" });
        return;
      }
      await adminService.updateUserRole(Number(id), role);
      res.json({ success: true, message: "User role updated successfully" });
    } catch (error) {
      next(error);
    }
  }

  // 💰 Báo cáo doanh thu
  async getRevenueReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { monthYear } = req.query;
      const report = await adminService.getRevenueReport(monthYear as string);
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  // ⚡ Báo cáo sử dụng trạm sạc
  async getUsageReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { monthYear } = req.query;
      const report = await adminService.getUsageReport(monthYear as string);
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  // 👨‍💼 Tạo tài khoản nhân viên mới (Staff)
  async createStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { Email, PasswordHash, FullName } = req.body;
      console.log("📥 Body nhận từ FE:", req.body);

      if (!Email || !PasswordHash || !FullName) {
        res.status(400).json({ success: false, message: "Thiếu thông tin cần thiết!" });
        return;
      }

      const result = await adminService.createStaff(Email, FullName, PasswordHash);

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.data,
        message: "Tạo tài khoản Staff thành công!",
      });
    } catch (error: any) {
      console.error("❌ Lỗi trong createStaff Controller:", error.message);
      res.status(500).json({ success: false, message: error.message || "Lỗi tạo tài khoản staff!" });
    }
  }

  // 👥 Lấy danh sách Staff
  async getAllStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffList = await adminService.getAllStaff();
      res.status(200).json({ success: true, data: staffList });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
>>>>>>> Stashed changes
