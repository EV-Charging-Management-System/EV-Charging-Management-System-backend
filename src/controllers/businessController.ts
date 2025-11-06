import type { AuthRequest } from "../middlewares/authMiddleware";
import type { NextFunction, Response } from "express";
import { getDbPool } from "../config/database";
import { Int, NVarChar, VarChar } from "mssql";
import { companyService } from "../services/companyService";
import { vehicleService } from "../services/vehicleService";

export class BusinessController {
  

  // 🟣 Lấy thông tin doanh nghiệp hiện tại
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
          SELECT
            u.UserId,
            u.UserName,
            u.Mail,
            u.RoleName,
            c.CompanyId,
            c.CompanyName,
            c.Address,
            c.Phone,
            c.Mail AS CompanyMail
          FROM [User] u
            LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
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

  // 🏢 Tạo công ty mới cho user và chờ admin duyệt (không dùng cột Status)
  async createCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokenUserId = req.user?.userId;
      const { userId: bodyUserId, companyName, address, mail, phone } = req.body || {};
      const userId = bodyUserId || tokenUserId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!companyName) {
        res.status(400).json({ error: "Company name is required" });
        return;
      }

      const pool = await getDbPool();

      // Check user
      const userRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`SELECT UserId, RoleName, CompanyId FROM [User] WHERE UserId = @UserId`);
      const user = userRs.recordset[0];
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      // If already a business and has a company, just return the existing company id
      if (user.RoleName === "BUSINESS" && user.CompanyId) {
        res.status(200).json({
          message: "Company created successfully, waiting for admin approval",
          companyId: user.CompanyId,
        });
        return;
      }
      // If already has a company (pending state), return the existing company id with the same success message
      if (user.CompanyId) {
        res.status(200).json({
          message: "Company created successfully, waiting for admin approval",
          companyId: user.CompanyId,
        });
        return;
      }

      // Create company
      const newCompany = await companyService.createCompany({
        CompanyName: companyName,
        Address: address,
        Mail: mail,
        Phone: phone,
      });

      // Attach to user and set pending
      await pool
        .request()
        .input("UserId", Int, userId)
        .input("CompanyId", Int, newCompany.CompanyId)
        .query(`UPDATE [User] SET CompanyId = @CompanyId WHERE UserId = @UserId`);

      res.status(200).json({
        message: "Company created successfully, waiting for admin approval",
        companyId: newCompany.CompanyId,
      });
    } catch (error) {
      console.error("❌ Lỗi trong createCompany:", error);
      next(error);
    }
  }

  // 🚗 Thêm xe: nếu user là BUSINESS (đã duyệt) thì gắn vào Company, nếu chưa có Company thì gắn vào User
  async addVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { vehicleName, vehicleType, licensePlate, battery } = req.body || {};
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!vehicleName || !vehicleType || !licensePlate) {
        res.status(400).json({ error: "vehicleName, vehicleType, and licensePlate are required" });
        return;
      }

      const pool = await getDbPool();

      // Get user info
      const userRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`SELECT UserId, RoleName, CompanyId FROM [User] WHERE UserId = @UserId`);
      const user = userRs.recordset[0];
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Check existing vehicle by plate
      const existingVehicleRs = await pool
        .request()
        .input("LicensePlate", VarChar(50), licensePlate)
        .query(`SELECT TOP 1 * FROM [Vehicle] WHERE LicensePlate = @LicensePlate`);
      const existingVehicle = existingVehicleRs.recordset[0];
      if (existingVehicle) {
        // If already belongs to a company, block
        if (existingVehicle.CompanyId) {
          res.status(400).json({ error: "Vehicle already belongs to a company" });
          return;
        }
        // If belongs to another user, block duplicate plate
        if (existingVehicle.UserId && existingVehicle.UserId !== userId) {
          res.status(400).json({ error: "Vehicle already belongs to another user" });
          return;
        }
      }

  if (user.CompanyId && user.RoleName === "BUSINESS") {
        // Assign to company
        const created = await companyService.addVehicleToCompany(
          user.CompanyId,
          vehicleName,
          vehicleType,
          licensePlate,
          battery,
        );
        res.status(201).json({
          message: "Vehicle added to company successfully",
          vehicleId: created.VehicleId,
          companyId: user.CompanyId,
          licensePlate,
        });
        return;
      }

      // Personal vehicle (no approved company)
      const created = await vehicleService.addVehicle(userId, vehicleName, vehicleType, licensePlate, battery);
      res.status(201).json({
        message: "Vehicle added successfully",
        ...created,
      });
    } catch (error) {
      console.error("❌ Lỗi trong addVehicle:", error);
      next(error);
    }
  }

  // ❌ Xóa xe theo biển số với các luật kèm status code
  async deleteVehicleByPlate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { licensePlate } = req.params as { licensePlate: string };
      if (!licensePlate) {
        res.status(400).json({ error: "License plate is required" });
        return;
      }

      const pool = await getDbPool();

      const vehicleRs = await pool
        .request()
        .input("LicensePlate", VarChar(50), licensePlate)
        .query(`SELECT TOP 1 * FROM [Vehicle] WHERE LicensePlate = @LicensePlate`);
      const vehicle = vehicleRs.recordset[0];
      if (!vehicle) {
        res.status(404).json({ error: "Vehicle not found" });
        return;
      }

      // Ensure the requester owns this personal vehicle
      if (vehicle.UserId && req.user?.userId && vehicle.UserId !== req.user.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // If vehicle belongs to a company, block deletion
      if (vehicle.CompanyId) {
        res.status(400).json({ error: "Vehicle belongs to an approved company and cannot be deleted" });
        return;
      }

      // Check active bookings
      const bookingActive = await pool
        .request()
        .input("VehicleId", Int, vehicle.VehicleId)
        .query(`SELECT TOP 1 1 FROM [Booking] WHERE VehicleId = @VehicleId AND Status = 'ACTIVE'`);
      if (bookingActive.recordset.length > 0) {
        res.status(409).json({ error: "Vehicle is in use and cannot be deleted" });
        return;
      }

      // Check ongoing charging sessions
      const sessionActive = await pool
        .request()
        .input("VehicleId", Int, vehicle.VehicleId)
        .query(`SELECT TOP 1 1 FROM [ChargingSession] WHERE VehicleId = @VehicleId AND (ChargingStatus = 'ONGOING' OR Status = 1) AND CheckoutTime IS NULL`);
      if (sessionActive.recordset.length > 0) {
        res.status(409).json({ error: "Vehicle is in use and cannot be deleted" });
        return;
      }

      // Safe to delete
      await vehicleService.deleteVehicle(vehicle.VehicleId);
      res.status(200).json({ message: "Vehicle deleted successfully" });
    } catch (error) {
      console.error("❌ Lỗi trong deleteVehicleByPlate:", error);
      next(error);
    }
  }

  // 📋 Danh sách xe: nếu user là BUSINESS và có Company -> theo Company; nếu không -> theo User
  async getVehicles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const pool = await getDbPool();
      const userRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`SELECT UserId, RoleName, CompanyId FROM [User] WHERE UserId = @UserId`);
      const user = userRs.recordset[0];
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (user.CompanyId && user.RoleName === "BUSINESS") {
        const rs = await pool
          .request()
          .input("CompanyId", Int, user.CompanyId)
          .query(`SELECT * FROM [Vehicle] WHERE CompanyId = @CompanyId ORDER BY VehicleId DESC`);
        res.status(200).json({ success: true, data: rs.recordset });
        return;
      }

      const rs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`SELECT * FROM [Vehicle] WHERE UserId = @UserId ORDER BY VehicleId DESC`);
      res.status(200).json({ success: true, data: rs.recordset });
    } catch (error) {
      console.error("❌ Lỗi trong getVehicles:", error);
      next(error);
    }
  }

  // 💳 Tổng quan thanh toán của doanh nghiệp
  async getPaymentsSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const pool = await getDbPool();

      // Get user's company
      const userRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT u.CompanyId, c.CompanyName
          FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE u.UserId = @UserId
        `);
      const info = userRs.recordset[0];

      if (!info?.CompanyId) {
        res.status(200).json({ totalPayments: 0, totalAmount: 0, currency: "VND", companyId: null, companyName: null });
        return;
      }

      // Aggregate payments for the company using Payment->Invoice OR Payment->Session->Vehicle
      const agg = await pool
        .request()
        .input("CompanyId", Int, info.CompanyId)
        .query(`
          SELECT 
            COUNT(DISTINCT p.PaymentId) AS totalPayments,
            ISNULL(SUM(p.TotalAmount), 0) AS totalAmount
          FROM [Payment] p
          LEFT JOIN [Invoice] i ON p.InvoiceId = i.InvoiceId
          LEFT JOIN [ChargingSession] cs ON p.SessionId = cs.SessionId
          LEFT JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          WHERE (i.CompanyId = @CompanyId OR v.CompanyId = @CompanyId) AND p.PaymentStatus IN ('Paid','PAID')
        `);

      const totalPayments = agg.recordset[0]?.totalPayments || 0;
      const totalAmount = agg.recordset[0]?.totalAmount || 0;

      res.status(200).json({
        totalPayments,
        totalAmount,
        currency: "VND",
        companyId: info.CompanyId,
        companyName: info.CompanyName,
      });
    } catch (error) {
      console.error("❌ Lỗi trong getPaymentsSummary:", error);
      next(error);
    }
  }
}

export const businessController = new BusinessController();
