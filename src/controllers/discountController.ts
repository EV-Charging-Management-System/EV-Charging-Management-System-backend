import type { AuthRequest } from "@/middlewares/authMiddleware";
import type { Response } from "express";
import { asyncHandler, createError } from "../middlewares/errorMiddleware";
import { getDiscountPercent, loadDiscountConfig, updatePremiumPercent } from "../utils/discount";

class DiscountController {
  getConfig = asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    const cfg = loadDiscountConfig();
    res.status(200).json({ success: true, data: cfg });
  });

  updatePremium = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { percent } = req.body;
    if (percent === undefined || percent === null) {
      throw createError("percent is required", 400, "VALIDATION_ERROR");
    }
    const n = Number(percent);
    if (!isFinite(n)) {
      throw createError("percent must be a number", 400, "VALIDATION_ERROR");
    }
    const cfg = updatePremiumPercent(n);
    res.status(200).json({ success: true, message: "Premium discount updated", data: cfg });
  });

  // convenience endpoint
  getPremium = asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    const premium = getDiscountPercent("Premium");
    res.status(200).json({ success: true, data: { Premium: premium } });
  });
}

export const discountController = new DiscountController();
