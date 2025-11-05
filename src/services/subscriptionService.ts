import { Int, NVarChar, Date as SqlDate } from "mssql";
import { getDbPool } from "../config/database";
<<<<<<< Updated upstream
import { buildVnpUrl } from "../utils/vnpay";

class SubscriptionService {
  // 🔹 Lấy tất cả gói Subscription (table: Subcription)
  async getAllSubscriptions(): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const result = await pool.request().query(`SELECT * FROM [Subcription]`);
=======
import { buildVnpUrl } from "../utils/vnpay"; // ✅ Dùng util VNPay có sẵn

class SubscriptionService {
  // 🔹 Lấy tất cả gói Subscription
  async getAllSubscriptions(): Promise<any[]> {
    const pool = await getDbPool();
    try {
      const result = await pool.request().query(`SELECT * FROM [Subscription]`);
>>>>>>> Stashed changes
      return result.recordset;
    } catch (error) {
      throw new Error("Error fetching subscriptions: " + error);
    }
  }

  // 🔹 Lấy subscription theo ID
  async getSubscriptionById(id: number): Promise<any | null> {
    const pool = await getDbPool();
    try {
<<<<<<< Updated upstream
      const result = await pool.request().input("SubcriptionId", Int, id).query(`SELECT * FROM [Subcription] WHERE SubcriptionId = @SubcriptionId`);
=======
      const result = await pool
        .request()
        .input("SubscriptionId", Int, id)
        .query(`SELECT * FROM [Subscription] WHERE SubscriptionId = @SubscriptionId`);
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    Status?: string;
=======
    SubStatus?: string;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
      // 1️⃣ Thêm mới bản ghi Subcription
=======
      // 1️⃣ Thêm mới bản ghi Subscription
>>>>>>> Stashed changes
      const insertResult = await pool
        .request()
        .input("UserId", Int, UserId)
        .input("CompanyId", Int, CompanyId)
        .input("PackageId", Int, PackageId)
<<<<<<< Updated upstream
        .input("StartMonth", NVarChar(100), StartMonth)
        .input("StartDate", SqlDate, StartDate)
        .input("DurationMonth", NVarChar(100), DurationMonth)
        .input("PaymentMethod", NVarChar(50), "VNPAY")
        .input("Status", NVarChar(20), "PENDING")
        .query(`
            INSERT INTO [Subcription]
            (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth, PaymentMethod, Status)
                OUTPUT INSERTED.*
            VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth, @PaymentMethod, @Status)
=======
        .input("StartMonth", NVarChar(100), StartMonth ?? "") // ✅ fix null → ""
        .input("StartDate", SqlDate, StartDate)
        .input("DurationMonth", NVarChar(100), DurationMonth ?? "") // ✅ fix null → ""
        .input("PaymentMethod", NVarChar(50), "VNPAY")
        .input("SubStatus", NVarChar(20), "PENDING")
        .query(`
          INSERT INTO [Subscription]
          (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth, PaymentMethod, SubStatus)
            OUTPUT INSERTED.*
          VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth, @PaymentMethod, @SubStatus)
>>>>>>> Stashed changes
        `);

      const subscription = insertResult.recordset[0];

      // 2️⃣ Sinh mã giao dịch duy nhất (TxnRef)
<<<<<<< Updated upstream
      const txnRef = `SUB_${subscription.SubcriptionId}_${Date.now()}`;
      const orderInfo = `Thanh toán gói Premium #${subscription.SubcriptionId}`;
=======
      const txnRef = `SUB_${subscription.SubscriptionId}_${Date.now()}`;
      const orderInfo = `Thanh toán gói Premium #${subscription.SubscriptionId}`;
>>>>>>> Stashed changes

      // 3️⃣ Sinh URL thanh toán VNPay
      const vnpUrl = buildVnpUrl({
        amount: 299000,
        orderInfo,
        txnRef,
        ipAddr: IpAddr,
      });

      // 4️⃣ Cập nhật lại TxnRef vào DB
      await pool
        .request()
<<<<<<< Updated upstream
        .input("SubcriptionId", Int, subscription.SubcriptionId)
        .input("TxnRef", NVarChar(200), txnRef)
        .query(`UPDATE [Subcription] SET TxnRef = @TxnRef WHERE SubcriptionId = @SubcriptionId`);
=======
        .input("SubscriptionId", Int, subscription.SubscriptionId)
        .input("TxnRef", NVarChar(50), txnRef)
        .query(`UPDATE [Subscription] SET TxnRef = @TxnRef WHERE SubscriptionId = @SubscriptionId`);
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
      Status?: string;
=======
      SubStatus?: string;
>>>>>>> Stashed changes
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
      const PaymentMethod = data.PaymentMethod ?? existing.PaymentMethod;
      const TxnRef = data.TxnRef ?? existing.TxnRef;
<<<<<<< Updated upstream
      const Status = data.Status ?? existing.Status;

      const result = await pool
        .request()
        .input("SubcriptionId", Int, id)
        .input("UserId", Int, UserId)
        .input("CompanyId", Int, CompanyId)
        .input("PackageId", Int, PackageId)
        .input("StartMonth", NVarChar(100), StartMonth)
        .input("StartDate", SqlDate, StartDate)
        .input("DurationMonth", NVarChar(100), DurationMonth)
        .input("PaymentMethod", NVarChar(50), PaymentMethod)
        .input("TxnRef", NVarChar(200), TxnRef)
        .input("Status", NVarChar(20), Status)
        .query(`
            UPDATE [Subcription]
            SET
                UserId = @UserId,
                CompanyId = @CompanyId,
                PackageId = @PackageId,
                StartMonth = @StartMonth,
                StartDate = @StartDate,
                DurationMonth = @DurationMonth,
                PaymentMethod = @PaymentMethod,
                TxnRef = @TxnRef,
                Status = @Status
                OUTPUT INSERTED.*
            WHERE SubcriptionId = @SubcriptionId
=======
      const SubStatus = data.SubStatus ?? existing.SubStatus;

      const result = await pool
        .request()
        .input("SubscriptionId", Int, id)
        .input("UserId", Int, UserId)
        .input("CompanyId", Int, CompanyId)
        .input("PackageId", Int, PackageId)
        .input("StartMonth", NVarChar(100), StartMonth ?? "") // ✅ fix null → ""
        .input("StartDate", SqlDate, StartDate)
        .input("DurationMonth", NVarChar(100), String(DurationMonth ?? ""))// ✅ fix null → ""
        .input("PaymentMethod", NVarChar(50), PaymentMethod)
        .input("TxnRef", NVarChar(50), TxnRef)
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
            PaymentMethod = @PaymentMethod,
            TxnRef = @TxnRef,
            SubStatus = @SubStatus
            OUTPUT INSERTED.*
          WHERE SubscriptionId = @SubscriptionId
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      const result = await pool.request().input("SubcriptionId", Int, id).query(`DELETE FROM [Subcription] WHERE SubcriptionId = @SubcriptionId`);
=======
      const result = await pool
        .request()
        .input("SubscriptionId", Int, id)
        .query(`DELETE FROM [Subscription] WHERE SubscriptionId = @SubscriptionId`);
>>>>>>> Stashed changes
      return result.rowsAffected[0] > 0;
    } catch (error) {
      throw new Error("Error deleting subscription: " + error);
    }
  }
}

export const subscriptionService = new SubscriptionService();
