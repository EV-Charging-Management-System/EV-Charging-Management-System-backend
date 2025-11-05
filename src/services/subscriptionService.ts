import { Int, NVarChar, Date as SqlDate } from "mssql";
import { getDbPool } from "../config/database";
import { buildVnpUrl } from "../utils/vnpay"; 

class SubscriptionService {
  // 🔹 Lấy tất cả gói Subscription
  async getAllSubscriptions(): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const result = await pool.request().query(`SELECT * FROM [Subscription]`);
      return result.recordset;
    } catch (error) {
      throw new Error("Error fetching subscriptions: " + error);
    }
  }

  // 🔹 Lấy subscription theo ID
  async getSubscriptionById(id: number): Promise<any | null> {
    const pool = await getDbPool();
    try {
      const result = await pool
        .request()
        .input("SubscriptionId", Int, id)
        .query(`SELECT * FROM [Subscription] WHERE SubscriptionId = @SubscriptionId`);
      return result.recordset[0] || null;
    } catch (error) {
      throw new Error("Error fetching subscription: " + error);
    }
  }

  // 🔹 Tạo mới subscription + sinh link VNPay
  async createSubscription(data: {
    UserId?: number;
    CompanyId?: number;
    PackageId: number;
    StartMonth?: string;
    StartDate: string;
    DurationMonth?: string;
    IpAddr?: string;
    SubStatus?: string;
  }): Promise<any> {
    const pool = await getDbPool();
    try {
      const {
        UserId = null,
        CompanyId = null,
        PackageId,
        StartMonth = null,
        StartDate,
        DurationMonth = null,
        IpAddr = "127.0.0.1",
      } = data;

      // 1️⃣ Thêm mới bản ghi Subscription
      const insertResult = await pool
        .request()
        .input("UserId", Int, UserId)
        .input("CompanyId", Int, CompanyId)
        .input("PackageId", Int, PackageId)
        .input("StartMonth", NVarChar(100), StartMonth ?? "") 
        .input("StartDate", SqlDate, StartDate)
        .input("DurationMonth", NVarChar(100), DurationMonth ?? "") 
        .input("SubStatus", NVarChar(20), "PENDING")
        .query(`
          INSERT INTO [Subscription]
          (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth, SubStatus)
            OUTPUT INSERTED.*
          VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth, @SubStatus)
        `);

      const subscription = insertResult.recordset[0];

      // 2️⃣ Sinh mã giao dịch duy nhất (TxnRef)
      const txnRef = `SUB_${subscription.SubscriptionId}_${Date.now()}`;
      const orderInfo = `Thanh toán gói Premium #${subscription.SubscriptionId}`;

      // 3️⃣ Sinh URL thanh toán VNPay
      const vnpUrl = buildVnpUrl({
        amount: 299000,
        orderInfo,
        txnRef,
        ipAddr: IpAddr,
      });

      // 4️⃣ (Optional) Persist TxnRef in DB — skipped due to current schema without TxnRef column

      // 5️⃣ Trả kết quả cho FE
      return {
        ...subscription,
        TxnRef: txnRef,
        vnpUrl,
      };
    } catch (error) {
      throw new Error("Error creating subscription: " + error);
    }
  }

  // 🔹 Cập nhật thông tin Subscription
  async updateSubscription(
    id: number,
    data: {
      UserId?: number;
      CompanyId?: number;
      PackageId?: number;
      StartMonth?: string;
      StartDate?: string;
      DurationMonth?: string;
      PaymentMethod?: string;
      TxnRef?: string;
      SubStatus?: string;
    }
  ): Promise<any> {
    const pool = await getDbPool();
    try {
      const existing = await this.getSubscriptionById(id);
      if (!existing) return null;

      const UserId = data.UserId ?? existing.UserId;
      const CompanyId = data.CompanyId ?? existing.CompanyId;
      const PackageId = data.PackageId ?? existing.PackageId;
      const StartMonth = data.StartMonth ?? existing.StartMonth;
      const StartDate = data.StartDate ?? existing.StartDate;
      const DurationMonth = data.DurationMonth ?? existing.DurationMonth;
      const SubStatus = data.SubStatus ?? existing.SubStatus;

      const result = await pool
        .request()
        .input("SubscriptionId", Int, id)
        .input("UserId", Int, UserId)
        .input("CompanyId", Int, CompanyId)
        .input("PackageId", Int, PackageId)
        .input("StartMonth", NVarChar(100), StartMonth ?? "") 
        .input("StartDate", SqlDate, StartDate)
        .input("DurationMonth", NVarChar(100), String(DurationMonth ?? ""))
        .input("SubStatus", NVarChar(20), SubStatus)
        .query(`
          UPDATE [Subscription]
          SET
            UserId = @UserId,
            CompanyId = @CompanyId,
            PackageId = @PackageId,
            StartMonth = @StartMonth,
            StartDate = @StartDate,
            DurationMonth = @DurationMonth,
            SubStatus = @SubStatus
            OUTPUT INSERTED.*
          WHERE SubscriptionId = @SubscriptionId
        `);

      return result.recordset[0];
    } catch (error) {
      throw new Error("Error updating subscription: " + error);
    }
  }

  // 🔹 Xóa subscription
  async deleteSubscription(id: number): Promise<boolean> {
    const pool = await getDbPool();
    try {
      const result = await pool
        .request()
        .input("SubscriptionId", Int, id)
        .query(`DELETE FROM [Subscription] WHERE SubscriptionId = @SubscriptionId`);
      return result.rowsAffected[0] > 0;
    } catch (error) {
      throw new Error("Error deleting subscription: " + error);
    }
  }
}

export const subscriptionService = new SubscriptionService();
