import type { Request, Response, NextFunction } from "express";
import { invoiceService } from "../services/invoiceService";

class InvoiceController {
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, userId } = req.body || {};

      const sid = Number(sessionId);
      const uid = Number(userId);

      if (!sid || isNaN(sid) || !uid || isNaN(uid)) {
        res.status(400).json({
          success: false,
          message: "sessionId và userId là bắt buộc và phải là số",
        });
        return;
      }

      const dto = await invoiceService.createInvoiceFromSession(sid, uid);

      res.status(201).json({
        success: true,
        data: dto,
      });
    } catch (error: any) {
      if (String(error?.message || "").includes("Charging session not found")) {
        res.status(404).json({ success: false, message: "Không tìm thấy charging session" });
        return;
      }
      next(error);
    }
  };
}

export const invoiceController = new InvoiceController();
