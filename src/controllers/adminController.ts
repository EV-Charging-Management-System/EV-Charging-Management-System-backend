import type { AuthRequest } from "../middlewares/authMiddleware";
import type { NextFunction, Response } from "express";
import { adminService } from "../services/adminService";
import { getDbPool } from "../config/database";
import { userService } from "../services/userService";

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

  // 🏢 Lấy chi tiết một yêu cầu duyệt doanh nghiệp theo UserId
  async getPendingBusinessApprovalById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = await adminService.getPendingBusinessApprovalById(Number(id));
      if (!data) {
        res.status(404).json({ success: false, message: "Approval not found" });
        return;
      }
      res.status(200).json({ success: true, data });
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

  // ✅/❌ Duyệt hoặc từ chối doanh nghiệp theo body
  async approveBusinessByBody(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, companyId, approve } = req.body || {};
      if (typeof userId !== "number" || typeof approve !== "boolean") {
        res.status(400).json({ message: "userId and approve are required" });
        return;
      }

      const pool = await getDbPool();

      if (approve) {
        // Ensure companyId belongs or set it
        if (typeof companyId !== "number") {
          res.status(400).json({ message: "companyId is required when approving" });
          return;
        }

        await pool
          .request()
          .input("UserId", userId)
          .input("CompanyId", companyId)
          .query(`UPDATE [User] SET RoleName = 'BUSINESS', CompanyId = @CompanyId WHERE UserId = @UserId`);

        res.status(200).json({
          message: "User upgraded to Business successfully",
          userId,
          role: "BUSINESS",
          companyId,
        });
        return;
      }

      // Reject: first detach user from company, then delete the company to satisfy FK constraints
      await pool
        .request()
        .input("UserId", userId)
        .query(`UPDATE [User] SET CompanyId = NULL WHERE UserId = @UserId`);

      if (typeof companyId === "number") {
        await pool.request().input("CompanyId", companyId).query(`DELETE FROM [Company] WHERE CompanyId = @CompanyId`);
      }

      res.status(200).json({
        message: "Company request rejected",
        userId,
      });
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
      const { Email, PasswordHash, FullName, Address } = req.body;
      console.log("📥 Body nhận từ FE:", req.body);

      if (!Email || !PasswordHash || !FullName || !Address) {
        res.status(400).json({ success: false, message: "Thiếu thông tin cần thiết!" });
        return;
      }

      const result = await adminService.createStaff(Email, FullName, PasswordHash, Address);

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
  async createStation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { stationName, address, stationStatus, stationDescrip, chargingPointTotal } = req.body;
      if (!stationName || !address || stationStatus === undefined || !stationDescrip || chargingPointTotal === undefined) {
        res.status(400).json({ message: "All fields are required" });
        return;
      }
      const newStation = await adminService.createStation(
        stationName,
        address,
        stationStatus,
        stationDescrip,
        chargingPointTotal
      );
      res.status(201).json({ success: true, data: newStation, message: "Station created successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async deleteStationById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = req.body
      if (!stationId) {
        res.status(400).json({ message: "stationId is required" })
        return
      }
      await adminService.deleteStationById(stationId)
      res.json({ success: true, message: "Station deleted successfully" })
    } catch (error) {
      next(error)
    }
  }
  async createPoint(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId, numberOfPort } = req.body
      if (!stationId || numberOfPort === undefined) {
        res.status(400).json({ message: "stationId and numberOfPort are required" })
        return
      }
      const newPoint = await adminService.createPoint(stationId, numberOfPort)
      res.status(201).json({ success: true, data: newPoint, message: "Point created successfully" })
    } catch (error) {
      next(error)
    }
  }
  async updatePoint(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pointId, numberOfPort, chargingPointStatus } = req.body
      if (!pointId) {
        res.status(400).json({ message: "pointId is required" })
        return
      }
      if (numberOfPort === undefined && !chargingPointStatus) {
        res.status(400).json({ message: "At least one of numberOfPort or chargingPointStatus is required" })
        return
      }
      await adminService.updatePoint(pointId, numberOfPort, chargingPointStatus)
      res.json({ success: true, message: "Point updated successfully" })
    } catch (error) {
      next(error)
    }
  }
  async deletePointById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pointId } = req.body
      if (!pointId) {
        res.status(400).json({ message: "pointId is required" })
        return
      }
      await adminService.deletePointById(pointId)
      res.json({ success: true, message: "Point deleted successfully" })
    } catch (error) {
      next(error)
    }
  }

  async createPort(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pointId, portName, portType, portTypeOfKwh, portTypePrice, portStatus } = req.body
      if (!pointId || !portName || !portType || portTypeOfKwh === undefined || portTypePrice === undefined) {
        res.status(400).json({ message: "pointId, portName, portType, portTypeOfKwh, and portTypePrice are required" })
        return
      }
      const newPort = await adminService.createPort(
        pointId,
        portName,
        portType,
        portTypeOfKwh,
        portTypePrice,
        portStatus,
      )
      res.status(201).json({ success: true, data: newPort, message: "Port created successfully" })
    } catch (error) {
      next(error)
    }
  }
  async updatePort(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { portId, portName, portType, chargingPortType, portTypeOfKwh, portTypePrice, portStatus } = req.body
      if (!portId) {
        res.status(400).json({ message: "portId is required" })
        return
      }
      await adminService.updatePort(portId, portName, portType, chargingPortType, portTypeOfKwh, portTypePrice, portStatus)
      res.json({ success: true, message: "Port updated successfully" })
    } catch (error) {
      next(error)
    }
  }
  async deletePortById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { portId } = req.body
      if (!portId) {
        res.status(400).json({ message: "portId is required" })
        return
      }
      await adminService.deletePortById(portId)
      res.json({ success: true, message: "Port deleted successfully" })
    } catch (error) {
      next(error)
    }
  }

  // 🛠️ Admin cập nhật hồ sơ của chính mình
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.user
      if (!authUser) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const { UserName, Mail, PassWord } = req.body || {}
      if (!UserName && !Mail && !PassWord) {
        res.status(400).json({ message: "At least one field (UserName, Mail, PassWord) is required" })
        return
      }

      const updated = await adminService.updateAdminProfile(authUser.userId, { UserName, Mail, PassWord })
      res.status(200).json({ success: true, data: updated, message: "Profile updated successfully" })
    } catch (error) {
      next(error)
    }
  }

  // 🗑️ Admin xóa người dùng theo ID (không cho phép xóa ADMIN khác)
  async deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const idFromParams = (req.params as any)?.id
      const idFromBody = (req.body as any)?.userId
      const userId = Number(idFromParams ?? idFromBody)
      if (Number.isNaN(userId)) {
        res.status(400).json({ message: "Invalid user id" })
        return
      }

      const requester = req.user
      if (!requester || requester.role !== 'ADMIN') {
        res.status(403).json({ message: "Forbidden" })
        return
      }

      await adminService.deleteUserCascading(userId)
      res.status(200).json({ success: true, message: "User deleted successfully" })
    } catch (error) {
      next(error)
    }
  }

  // ✏️ Admin cập nhật mọi thông tin của người dùng bất kỳ
  async updateAnyUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const idFromParams = (req.params as any)?.id
      const idFromBody = (req.body as any)?.userId
      const targetUserId = Number(idFromParams ?? idFromBody)
      if (Number.isNaN(targetUserId)) {
        res.status(400).json({ message: 'Invalid user id' })
        return
      }

      const requester = req.user
      if (!requester || requester.role !== 'ADMIN') {
        res.status(403).json({ message: 'Forbidden' })
        return
      }

      const payload = req.body || {}
      if (!payload || Object.keys(payload).length === 0) {
        res.status(400).json({ message: 'No fields provided to update' })
        return
      }

      const updated = await userService.updateUser(targetUserId, payload)
      if (!updated) {
        res.status(404).json({ message: 'User not found' })
        return
      }

      res.status(200).json({ success: true, data: updated, message: 'User updated successfully' })
    } catch (error) {
      next(error)
    }
  }
}
export const adminController = new AdminController()
