import { Int, NVarChar, Date as SqlDate } from "mssql";
import { getDbPool } from "../config/database";
import { paymentService } from "./paymentService";

export interface CreatedInvoiceDTO {
  invoiceId: number;
  userId: number;
  sessionId: number;
  monthYear: string;
  subtotal: number;
  penaltyFee: number;
  discount: number;
  totalAmount: number;
  paidStatus: "Pending" | "Paid" | string;
  createdAt: string; // YYYY-MM-DD
}

class InvoiceService {
  // Create invoice from a finished charging session
  async createInvoiceFromSession(sessionId: number, userId: number): Promise<CreatedInvoiceDTO> {
    const pool = await getDbPool();

    // 1) Load session price & penalty
    const sessionRs = await pool
      .request()
      .input("SessionId", Int, sessionId)
      .query(`
        SELECT TOP 1 SessionId, SessionPrice, PenaltyFee, CheckoutTime
        FROM [ChargingSession]
        WHERE SessionId = @SessionId
      `);
    const session = sessionRs.recordset[0];
    if (!session) {
      throw new Error("Charging session not found");
    }

    const sessionPrice: number = Number(session.SessionPrice || 0);
    const penaltyFee: number = Number(session.PenaltyFee || 0);
    const checkoutTime: Date | null = session.CheckoutTime ? new Date(session.CheckoutTime) : null;

    // 2) Determine month/year based on checkout time (fallback to today)
    const dt = checkoutTime ?? new Date();
    const monthYear = `${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()}`;

    // 3) Find user's company (optional)
    const userRs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`SELECT CompanyId FROM [User] WHERE UserId = @UserId`);
    const companyId: number | null = userRs.recordset[0]?.CompanyId ?? null;

    // 4) Check active subscription and determine discount percent from its Package
    let discountPercent = 0;
    const subRs = await pool
      .request()
      .input("UserId", Int, userId)
      .query(`
        SELECT TOP 1 s.SubscriptionId, s.StartDate, s.DurationMonth, s.SubStatus, s.PackageId
        FROM [Subscription] s
        WHERE s.UserId = @UserId AND s.SubStatus = 'ACTIVE'
        ORDER BY s.StartDate DESC
      `);

    if (subRs.recordset[0]) {
      const s = subRs.recordset[0];
      const startDate = s.StartDate ? new Date(s.StartDate) : null;
      const durationMonths = Number(s.DurationMonth || 0) || 1;

      if (startDate) {
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + durationMonths);
        const now = new Date();
        const stillActive = now < endDate;
        if (stillActive && s.PackageId) {
          const pkg = await pool
            .request()
            .input("PackageId", Int, s.PackageId)
            .query(`SELECT TOP 1 * FROM [Package] WHERE PackageId = @PackageId`);
          const row = pkg.recordset[0];
          if (row) {
            // Try common column names gracefully
            const p1 = Number(row.DiscountPercent || 0);
            const p2 = Number(row.Discount || 0);
            const p3 = Number(row.Percent || 0);
            discountPercent = [p1, p2, p3].find((x) => !isNaN(x) && x > 0) || 0;
          }
        }
      }
    }

    const subtotal = Math.max(0, Math.round(sessionPrice));
    const penalty = Math.max(0, Math.round(penaltyFee));
    const beforeDiscount = subtotal + penalty;
    const discount = Math.max(0, Math.round((beforeDiscount * discountPercent) / 100));
    const totalAmount = Math.max(0, beforeDiscount - discount);

    // 5) Persist invoice record (reuse existing minimal create to avoid schema mismatch)
    const created = await paymentService.createInvoice(userId, companyId, monthYear, totalAmount);
    const invoiceId: number = created?.InvoiceId || created?.invoiceId || created?.InvoiceID || created?.id;
    if (!invoiceId) {
      throw new Error("Failed to create invoice record");
    }

    // 6) Optional: try to patch SessionId if column exists (best-effort, ignore errors)
    try {
      await pool
        .request()
        .input("InvoiceId", Int, invoiceId)
        .input("SessionId", Int, sessionId)
        .query(`UPDATE [Invoice] SET SessionId = @SessionId WHERE InvoiceId = @InvoiceId`);
    } catch (_) {
      // ignore if SessionId column doesn't exist
    }

    // 7) Return DTO in desired shape
    const createdAt = new Date();
    const createdAtStr = `${createdAt.getFullYear()}-${(createdAt.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${createdAt.getDate().toString().padStart(2, "0")}`;

    return {
      invoiceId,
      userId,
      sessionId,
      monthYear,
      subtotal,
      penaltyFee: penalty,
      discount,
      totalAmount,
      paidStatus: "Pending",
      createdAt: createdAtStr,
    };
  }
}

export const invoiceService = new InvoiceService();
