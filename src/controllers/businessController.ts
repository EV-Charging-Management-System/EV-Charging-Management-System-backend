import type { AuthRequest } from "../middlewares/authMiddleware";
import type { NextFunction, Response } from "express";
import { getDbPool } from "../config/database";
import { Int, NVarChar, VarChar, Date as SqlDate } from "mssql";
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
        res.status(401).json({ success: false, error: "Unauthorized: missing or invalid token", code: "AUTH_REQUIRED" });
        return;
      }

      const name = (companyName ?? "").toString().trim();
      const addr = address?.toString().trim();
      const email = mail?.toString().trim();
      const phoneNum = phone?.toString().trim();

      if (!name) {
        res.status(400).json({ success: false, error: "companyName is required", code: "VALIDATION_ERROR", field: "companyName" });
        return;
      }
      if (name.length > 100) {
        res.status(400).json({ success: false, error: "companyName must be at most 100 characters", code: "VALIDATION_ERROR", field: "companyName" });
        return;
      }
      if (addr && addr.length > 100) {
        res.status(400).json({ success: false, error: "address must be at most 100 characters", code: "VALIDATION_ERROR", field: "address" });
        return;
      }
      if (email && email.length > 100) {
        res.status(400).json({ success: false, error: "mail must be at most 100 characters", code: "VALIDATION_ERROR", field: "mail" });
        return;
      }
      if (phoneNum && phoneNum.length > 100) {
        res.status(400).json({ success: false, error: "phone must be at most 100 characters", code: "VALIDATION_ERROR", field: "phone" });
        return;
      }
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          res.status(400).json({ success: false, error: "Invalid email format", code: "VALIDATION_ERROR", field: "mail" });
          return;
        }
      }
      if (phoneNum) {
        const phoneRegex = /^\+?[0-9\-\s]{8,20}$/;
        if (!phoneRegex.test(phoneNum)) {
          res.status(400).json({ success: false, error: "Invalid phone format", code: "VALIDATION_ERROR", field: "phone" });
          return;
        }
      }

      const pool = await getDbPool();

      // Check user
      const userRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT u.UserId, u.RoleName, u.CompanyId, c.CompanyName
          FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE u.UserId = @UserId
        `);
      const user = userRs.recordset[0];
      if (!user) {
        res.status(404).json({ success: false, error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      // If user already has a company (either pending or already business), update that company with provided data
      if (user.CompanyId) {
        // Optional: prevent duplicate name with other companies
        const dupUpdate = await pool
          .request()
          .input("CompanyName", NVarChar(100), name)
          .input("CompanyId", Int, user.CompanyId)
          .query(`SELECT TOP 1 CompanyId FROM [Company] WHERE CompanyName = @CompanyName AND CompanyId <> @CompanyId`);
        if (dupUpdate.recordset.length > 0) {
          res.status(409).json({ success: false, error: "Company name already exists", code: "COMPANY_CONFLICT" });
          return;
        }

        await companyService.updateCompany(user.CompanyId, {
          CompanyName: name,
          Address: addr,
          Mail: email,
          Phone: phoneNum,
        });

        res.status(200).json({
          message: "Company created successfully, waiting for admin approval",
          companyId: user.CompanyId,
        });
        return;
      }

      // Check duplicate company name
      const dup = await pool
        .request()
        .input("CompanyName", NVarChar(100), name)
        .query(`SELECT TOP 1 CompanyId FROM [Company] WHERE CompanyName = @CompanyName`);
      if (dup.recordset.length > 0) {
        res.status(409).json({ success: false, error: "Company name already exists", code: "COMPANY_CONFLICT" });
        return;
      }

      // Create company
      const newCompany = await companyService.createCompany({
        CompanyName: name,
        Address: addr,
        Mail: email,
        Phone: phoneNum,
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
        .query(`
          SELECT u.UserId, u.RoleName, u.CompanyId, c.CompanyName
          FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE u.UserId = @UserId
        `);
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
        const belongsToOtherUser = existingVehicle.UserId && existingVehicle.UserId !== userId;
        const isBusiness = user.RoleName === "BUSINESS" && user.CompanyId;

        // BUSINESS can attach vehicle of another user if not yet attached to a company
        if (isBusiness && belongsToOtherUser && !existingVehicle.CompanyId) {
          await pool
            .request()
            .input("VehicleId", Int, existingVehicle.VehicleId)
            .input("CompanyId", Int, user.CompanyId)
            .query(`UPDATE [Vehicle] SET CompanyId = @CompanyId WHERE VehicleId = @VehicleId`);

          // Optionally update name/type/battery if provided (do not overwrite with undefined)
          await pool
            .request()
            .input("VehicleId", Int, existingVehicle.VehicleId)
            .input("VehicleName", VarChar(100), vehicleName)
            .input("VehicleType", VarChar(50), vehicleType)
            .input("Battery", Int, battery ?? existingVehicle.Battery ?? 50)
            .query(`
              UPDATE [Vehicle]
              SET VehicleName = @VehicleName, VehicleType = @VehicleType, Battery = @Battery
              WHERE VehicleId = @VehicleId
            `);

          const refreshed = await pool
            .request()
            .input("VehicleId", Int, existingVehicle.VehicleId)
            .query(`SELECT VehicleId, UserId, CompanyId, VehicleName, VehicleType, LicensePlate, Battery FROM [Vehicle] WHERE VehicleId = @VehicleId`);
          const v = refreshed.recordset[0];
          res.status(200).json({
            message: "Vehicle attached to business successfully",
            vehicleId: v.VehicleId,
            companyId: v.CompanyId,
            licensePlate: v.LicensePlate,
            vehicleName: v.VehicleName,
            vehicleType: v.VehicleType,
            battery: v.Battery,
            attached: true,
          });
          return;
        }

        // BUSINESS attaching own existing vehicle without company yet
        if (isBusiness && !belongsToOtherUser && !existingVehicle.CompanyId) {
          await pool
            .request()
            .input("VehicleId", Int, existingVehicle.VehicleId)
            .input("CompanyId", Int, user.CompanyId)
            .query(`UPDATE [Vehicle] SET CompanyId = @CompanyId WHERE VehicleId = @VehicleId`);

          const refreshed = await pool
            .request()
            .input("VehicleId", Int, existingVehicle.VehicleId)
            .query(`SELECT VehicleId, UserId, CompanyId, VehicleName, VehicleType, LicensePlate, Battery FROM [Vehicle] WHERE VehicleId = @VehicleId`);
          const v = refreshed.recordset[0];
          res.status(200).json({
            message: "Existing vehicle assigned to company successfully",
            vehicleId: v.VehicleId,
            companyId: v.CompanyId,
            licensePlate: v.LicensePlate,
            vehicleName: v.VehicleName,
            vehicleType: v.VehicleType,
            battery: v.Battery,
            attached: true,
          });
          return;
        }

        // If already belongs to a company (any user), just return info (no error for BUSINESS) else block for non-business
        if (existingVehicle.CompanyId) {
          res.status(200).json({
            message: "Vehicle already belongs to a company",
            vehicleId: existingVehicle.VehicleId,
            companyId: existingVehicle.CompanyId,
            licensePlate: existingVehicle.LicensePlate,
            vehicleName: existingVehicle.VehicleName,
            vehicleType: existingVehicle.VehicleType,
            battery: existingVehicle.Battery,
            attached: true,
          });
          return;
        }

        if (belongsToOtherUser) {
          // Non-business users cannot attach another user's vehicle
            res.status(400).json({ error: "Vehicle already belongs to another user" });
            return;
        }

        // Same user adding same plate again -> treat as idempotent update
        await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .input("VehicleName", VarChar(100), vehicleName)
          .input("VehicleType", VarChar(50), vehicleType)
          .input("Battery", Int, battery ?? existingVehicle.Battery ?? 50)
          .query(`
            UPDATE [Vehicle]
            SET VehicleName = @VehicleName, VehicleType = @VehicleType, Battery = @Battery
            WHERE VehicleId = @VehicleId
          `);
        const updatedSame = await pool
          .request()
          .input("VehicleId", Int, existingVehicle.VehicleId)
          .query(`SELECT VehicleId, UserId, CompanyId, VehicleName, VehicleType, LicensePlate, Battery FROM [Vehicle] WHERE VehicleId = @VehicleId`);
        const v2 = updatedSame.recordset[0];
        res.status(200).json({
          message: "Vehicle already exists - updated details",
          vehicleId: v2.VehicleId,
          companyId: v2.CompanyId ?? null,
          licensePlate: v2.LicensePlate,
          vehicleName: v2.VehicleName,
          vehicleType: v2.VehicleType,
          battery: v2.Battery,
          attached: false,
        });
        return;
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

      // User vehicle (no approved company)
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

      // Ensure the requester owns this user vehicle
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
        .query(`
          SELECT u.UserId, u.RoleName, u.CompanyId, c.CompanyName
          FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE u.UserId = @UserId
        `);
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

      // Aggregate by invoices for the company to avoid misattribution (pay-all payments have no InvoiceId)
      const agg = await pool
        .request()
        .input("CompanyId", Int, info.CompanyId)
        .query(`
          SELECT 
            COUNT(*) AS totalInvoicesPaid,
            ISNULL(SUM(TotalAmount), 0) AS totalAmount
          FROM [Invoice]
          WHERE CompanyId = @CompanyId AND PaidStatus IN ('Paid','PAID')
        `);

      const totalPayments = agg.recordset[0]?.totalInvoicesPaid || 0;
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

  // � Tất cả lịch sạc (ChargingSession) của mọi xe trong doanh nghiệp
  async getCompanySessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokenUserId = req.user?.userId;
      if (!tokenUserId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { companyId } = req.params as { companyId: string };
      const { bookingId } = req.query as { bookingId?: string };

      const pool = await getDbPool();

      // Always derive company from authenticated user to avoid leaking other companies' data
      const userRs = await pool
        .request()
        .input("UserId", Int, tokenUserId)
        .query(`SELECT TOP 1 CompanyId FROM [User] WHERE UserId = @UserId`);
      const userCompanyId = userRs.recordset[0]?.CompanyId as number | undefined;

      if (!userCompanyId) {
        res.status(403).json({ success: false, message: "User does not belong to any company" });
        return;
      }

      // Optional: if path param provided but doesn't match user's company, reject
      if (companyId && Number(companyId) !== userCompanyId) {
        res.status(403).json({ success: false, message: "Forbidden: company mismatch" });
        return;
      }

      const request = pool.request().input("CompanyId", Int, userCompanyId);
      let whereClause = "v.CompanyId = @CompanyId";
      if (bookingId) {
        const bid = Number(bookingId);
        if (!isNaN(bid)) {
          request.input("BookingId", Int, bid);
          whereClause += " AND cs.BookingId = @BookingId";
        }
      }

      const rs = await request.query(`
          SELECT 
            cs.SessionId, cs.StationId, cs.PointId, cs.PortId, cs.BookingId, cs.VehicleId,
            cs.TotalTime, cs.ChargingStatus, cs.Pause, cs.SessionPrice, cs.CheckinTime, cs.CheckoutTime,
            cs.Status, cs.PenaltyFee, cs.BatteryPercentage,
            v.LicensePlate, v.VehicleName
          FROM [ChargingSession] cs
          INNER JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          WHERE ${whereClause}
          ORDER BY cs.CheckoutTime DESC, cs.SessionId DESC
        `);

      res.status(200).json({ success: true, data: rs.recordset });
    } catch (error) {
      console.error("❌ Lỗi trong getCompanySessions:", error);
      next(error);
    }
  }

  // � Tổng quan payment của user sở hữu xe theo biển số trong công ty (all-time)
  async getPaymentsSummaryByPlate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { licensePlate, companyId } = req.query as { licensePlate?: string; companyId?: string };
      if (!licensePlate || !companyId) {
        res.status(400).json({ success: false, message: "licensePlate và companyId là bắt buộc" });
        return;
      }

      const cid = Number(companyId);
      if (isNaN(cid)) {
        res.status(400).json({ success: false, message: "companyId không hợp lệ" });
        return;
      }

      const pool = await getDbPool();

      const vRs = await pool
        .request()
        .input("LicensePlate", VarChar(100), licensePlate)
        .query(`SELECT TOP 1 VehicleId, CompanyId, UserId, VehicleName FROM [Vehicle] WHERE LicensePlate = @LicensePlate`);
      const vehicle = vRs.recordset[0];
      if (!vehicle || vehicle.CompanyId !== cid) {
        res.status(404).json({ success: false, message: "Không tìm thấy xe thuộc công ty" });
        return;
      }

      const userId = vehicle.UserId;
      if (!userId) {
        res.status(404).json({ success: false, message: "Xe chưa có user sở hữu" });
        return;
      }

      const uRs = await pool.request().input("UserId", Int, userId).query(`SELECT UserId, UserName FROM [User] WHERE UserId = @UserId`);
      const user = uRs.recordset[0];

      const sumsRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT 
            COUNT(*) AS CountPayments,
            ISNULL(SUM(TotalAmount),0) AS TotalAmount,
            ISNULL(SUM(CASE WHEN PaymentStatus IN ('Paid','PAID') THEN TotalAmount ELSE 0 END),0) AS PaidAmount,
            ISNULL(SUM(CASE WHEN PaymentStatus = 'Pending' THEN TotalAmount ELSE 0 END),0) AS PendingAmount
          FROM [Payment]
          WHERE UserId = @UserId
        `);

      const row = sumsRs.recordset[0] || { CountPayments: 0, TotalAmount: 0, PaidAmount: 0, PendingAmount: 0 };

      res.status(200).json({
        success: true,
        data: {
          companyId: cid,
          licensePlate,
          user: user ? { userId: user.UserId, name: user.UserName } : null,
          paymentsSummary: {
            totalCount: Number(row.CountPayments || 0),
            totalAmount: Number(row.TotalAmount || 0),
            paidAmount: Number(row.PaidAmount || 0),
            pendingAmount: Number(row.PendingAmount || 0),
          },
        },
      });
    } catch (error) {
      console.error("❌ Lỗi trong getPaymentsSummaryByPlate:", error);
      next(error);
    }
  }

  // ��📄 Invoices & Payments theo biển số xe trong công ty
  async getInvoicePaymentByPlate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { licensePlate, companyId } = req.query as { licensePlate?: string; companyId?: string };
      if (!licensePlate || !companyId) {
        res.status(400).json({ success: false, message: "licensePlate và companyId là bắt buộc" });
        return;
      }

      const companyIdNum = Number(companyId);
      if (isNaN(companyIdNum)) {
        res.status(400).json({ success: false, message: "companyId không hợp lệ" });
        return;
      }

      const pool = await getDbPool();

      // Ensure vehicle belongs to company
      const vRs = await pool
        .request()
        .input("LicensePlate", VarChar(50), licensePlate)
        .query(`SELECT TOP 1 VehicleId, CompanyId, UserId FROM [Vehicle] WHERE LicensePlate = @LicensePlate`);
      const vehicle = vRs.recordset[0];
      if (!vehicle || vehicle.CompanyId !== companyIdNum) {
        res.status(404).json({ success: false, message: "Không tìm thấy xe thuộc công ty" });
        return;
      }

      // Find a user linked to this vehicle via recent session
      const uRs = await pool
        .request()
        .input("VehicleId", Int, vehicle.VehicleId)
        .query(`
          SELECT TOP 1 u.UserId, u.UserName
          FROM [ChargingSession] cs
          INNER JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          INNER JOIN [User] u ON v.UserId = u.UserId
          WHERE cs.VehicleId = @VehicleId
          ORDER BY cs.CheckoutTime DESC
        `);

      const u = uRs.recordset[0];
      const userId = u?.UserId as number | undefined;

      let invoices: any[] = [];
      let payments: any[] = [];
      if (userId) {
        const invRs = await pool
          .request()
          .input("UserId", Int, userId)
          .query(`
            SELECT InvoiceId, SessionId, TotalAmount, PaidStatus, CreatedAt
            FROM [Invoice]
            WHERE UserId = @UserId
            ORDER BY CreatedAt DESC
          `);
        invoices = invRs.recordset;

        const payRs = await pool
          .request()
          .input("UserId", Int, userId)
          .query(`
            SELECT PaymentId, TotalAmount, PaymentStatus, PaymentTime
            FROM [Payment]
            WHERE UserId = @UserId
            ORDER BY PaymentTime DESC
          `);
        payments = payRs.recordset;
      }

      res.status(200).json({
        success: true,
        data: {
          companyId: companyIdNum,
          licensePlate,
          user: userId ? { userId, name: u.UserName } : null,
          invoices: invoices.map((x) => ({
            invoiceId: x.InvoiceId,
            sessionId: x.SessionId ?? null,
            totalAmount: x.TotalAmount,
            paidStatus: x.PaidStatus,
          })),
          payments: payments.map((p) => ({
            paymentId: p.PaymentId,
            totalAmount: p.TotalAmount,
            paymentStatus: p.PaymentStatus,
            paymentTime: p.PaymentTime,
          })),
        },
      });
    } catch (error) {
      console.error("❌ Lỗi trong getInvoicePaymentByPlate:", error);
      next(error);
    }
  }

  // 📊 Báo cáo tổng quan doanh nghiệp (all-time)
  async getCompanyOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyIdParam = (req.params as any)?.companyId as string | undefined;
      const companyIdQuery = (req.query as any)?.companyId as string | undefined;
      const companyId = companyIdParam ?? companyIdQuery;
      if (!companyId) {
        res.status(400).json({ success: false, message: "companyId là bắt buộc" });
        return;
      }
      const cid = Number(companyId);
      if (isNaN(cid)) {
        res.status(400).json({ success: false, message: "companyId không hợp lệ" });
        return;
      }

  // All-time report (no month/year)

      const pool = await getDbPool();

      // Company name
      const cRs = await pool
        .request()
        .input("CompanyId", Int, cid)
        .query(`SELECT TOP 1 CompanyName FROM [Company] WHERE CompanyId = @CompanyId`);
      const companyName = cRs.recordset[0]?.CompanyName ?? null;

      // Total sessions (all time) for company vehicles
      const sessRs = await pool
        .request()
        .input("CompanyId", Int, cid)
        .query(`
          SELECT COUNT(*) AS TotalSessions, ISNULL(SUM(ISNULL(cs.PenaltyFee,0)),0) AS TotalPenalty
          FROM [ChargingSession] cs
          INNER JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          WHERE v.CompanyId = @CompanyId
        `);
      const totalSessions = Number(sessRs.recordset[0]?.TotalSessions || 0);
      const vehicleRs = await pool
  .request()
  .input("CompanyId", Int, cid)
  .query(`
    SELECT COUNT(*) AS TotalVehicles
    FROM [Vehicle]
    WHERE CompanyId = @CompanyId
  `);
const totalVehicles = Number(vehicleRs.recordset[0]?.TotalVehicles || 0);

      const totalPenaltyFee = Number(sessRs.recordset[0]?.TotalPenalty || 0);

      // Invoices counts for company (all time)
      const invCountRs = await pool
        .request()
        .input("CompanyId", Int, cid)
        .query(`
          SELECT 
            COUNT(*) AS Total,
            SUM(CASE WHEN PaidStatus = 'Paid' THEN 1 ELSE 0 END) AS Paid
          FROM [Invoice]
          WHERE CompanyId = @CompanyId
        `);
      const totalInvoices = Number(invCountRs.recordset[0]?.Total || 0);
      const paidInvoices = Number(invCountRs.recordset[0]?.Paid || 0);
      const unpaidInvoices = Math.max(0, totalInvoices - paidInvoices);

      // Total revenue from payments (by linking through Invoice or Session->Vehicle) all time
      const payRs = await pool
        .request()
        .input("CompanyId", Int, cid)
        .query(`
          SELECT ISNULL(SUM(p.TotalAmount),0) AS TotalAmount
          FROM [Payment] p
          LEFT JOIN [Invoice] i ON p.InvoiceId = i.InvoiceId
          LEFT JOIN [ChargingSession] cs ON p.SessionId = cs.SessionId
          LEFT JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          WHERE p.PaymentStatus IN ('Paid','PAID')
            AND (i.CompanyId = @CompanyId OR v.CompanyId = @CompanyId)
        `);
      const totalRevenue = Number(payRs.recordset[0]?.TotalAmount || 0);

      // Top users by spend and sessions in company (all time)
      const topRs = await pool
        .request()
        .input("CompanyId", Int, cid)
        .query(`
          SELECT TOP 5 u.UserId, u.UserName AS Name,
                 ISNULL(SUM(p.TotalAmount),0) AS TotalSpent,
                 ISNULL(COUNT(DISTINCT cs.SessionId),0) AS Sessions
          FROM [User] u
          LEFT JOIN [Payment] p ON p.UserId = u.UserId AND p.PaymentStatus IN ('Paid','PAID')
          LEFT JOIN [Vehicle] v ON v.UserId = u.UserId AND v.CompanyId = @CompanyId
          LEFT JOIN [ChargingSession] cs ON cs.VehicleId = v.VehicleId
          WHERE u.CompanyId = @CompanyId
          GROUP BY u.UserId, u.UserName
          ORDER BY TotalSpent DESC
        `);

      // Subscription count (ACTIVE) for this company
      const subRs = await pool
        .request()
        .input("CompanyId", Int, cid)
        .query(`SELECT COUNT(*) AS Cnt FROM [Subscription] WHERE CompanyId = @CompanyId AND SubStatus = 'ACTIVE'`);
      const subscriptionCount = Number(subRs.recordset[0]?.Cnt || 0);

      res.status(200).json({
        success: true,
        data: {
          companyId: cid,
          companyName,
          totalSessions,
          totalVehicles,   
          totalInvoices,
          paidInvoices,
          unpaidInvoices,
          totalRevenue,
          totalPenaltyFee,
          subscriptionCount,
          topUsers: topRs.recordset.map((r: any) => ({
            userId: r.UserId,
            name: r.Name,
            totalSpent: Number(r.TotalSpent || 0),
            sessions: Number(r.Sessions || 0),
          })),
        },
      });
    } catch (error) {
      console.error("❌ Lỗi trong getCompanyOverview:", error);
      next(error);
    }
  }
}

export const businessController = new BusinessController();
