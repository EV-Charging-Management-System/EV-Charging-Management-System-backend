import type { AuthRequest } from "../middlewares/authMiddleware";
import type { NextFunction, Response } from "express";
import { getDbPool } from "../config/database";
import { Int, NVarChar, VarChar, Date as SqlDate } from "mssql";
import { businessService } from "../services/businessService";

export class BusinessController {
  

  // 🟣 Lấy thông tin doanh nghiệp hiện tại
  async getBusinessProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập!" });
        return;
      }
      const info = await businessService.getBusinessProfile(userId)
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

  // 📄 Danh sách toàn bộ Invoice của công ty (chỉ cho phép trong cùng công ty)
  async getCompanyInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokenUserId = req.user?.userId
      if (!tokenUserId) {
        res.status(401).json({ success: false, message: "Unauthorized" })
        return
      }

      const { companyId } = req.params as { companyId: string }
      const { status } = req.query as { status?: string }
      const cid = Number(companyId)
      if (!cid || Number.isNaN(cid)) {
        res.status(400).json({ success: false, message: "companyId không hợp lệ" })
        return
      }

      const pool = await getDbPool()
      const uRs = await pool
        .request()
        .input("UserId", Int, tokenUserId)
        .query(`SELECT TOP 1 CompanyId FROM [User] WHERE UserId = @UserId`)
      const userCompanyId = uRs.recordset[0]?.CompanyId as number | undefined

      if (!userCompanyId) {
        res.status(403).json({ success: false, message: "User không thuộc công ty nào" })
        return
      }

      if (userCompanyId !== cid) {
        res.status(403).json({ success: false, message: "Forbidden: company mismatch" })
        return
      }

      const invoices = await businessService.getCompanyInvoices(cid, status)
      res.status(200).json({ success: true, data: invoices })
    } catch (error) {
      console.error("❌ Lỗi trong getCompanyInvoices:", error)
      next(error)
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
      const result = await businessService.createCompanyForUser(Number(userId), { companyName, address, mail, phone })
      res.status(result.httpCode).json(result.body)
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

      const result = await businessService.addVehicleForUser(userId, { vehicleName, vehicleType, licensePlate, battery })
      res.status(result.httpCode).json(result.body)
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

      const result = await businessService.deleteVehicleByPlate(licensePlate, req.user?.userId)
      res.status(result.httpCode).json(result.body)
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
      const result = await businessService.getVehiclesForUser(userId)
      res.status(result.httpCode).json(result.body)
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
      const userRs = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT u.CompanyId, c.CompanyName
          FROM [User] u
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE u.UserId = @UserId
        `)
      const info = userRs.recordset[0]

      if (!info?.CompanyId) {
        res.status(200).json({ totalPayments: 0, totalAmount: 0, currency: "VND", companyId: null, companyName: null });
        return;
      }

      const agg = await businessService.getCompanyInvoiceAggregates(info.CompanyId)
      const totalPayments = agg.totalInvoicesPaid
      const totalAmount = agg.totalAmount

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

      const bid = bookingId ? Number(bookingId) : undefined
      const data = await businessService.getCompanySessions(userCompanyId, bid)
      res.status(200).json({ success: true, data });
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
      const result = await businessService.getPaymentsSummaryByPlate(licensePlate, cid)
      if ((result as any).notFound) {
        res.status(404).json({ success: false, message: "Không tìm thấy xe thuộc công ty" })
        return
      }
      if ((result as any).noUser) {
        res.status(404).json({ success: false, message: "Xe chưa có user sở hữu" })
        return
      }

      res.status(200).json({ success: true, data: result })
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
      const data = await businessService.getInvoicePaymentByPlate(licensePlate, companyIdNum)
      if ((data as any).notFound) {
        res.status(404).json({ success: false, message: "Không tìm thấy xe thuộc công ty" })
        return
      }

      res.status(200).json({ success: true, data })
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
      const data = await businessService.getCompanyOverview(cid)
      res.status(200).json({ success: true, data })
    } catch (error) {
      console.error("❌ Lỗi trong getCompanyOverview:", error);
      next(error);
    }
  }
}

export const businessController = new BusinessController();
