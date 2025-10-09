import { AuthRequest } from "@/middlewares/authMiddleware";
import { NextFunction,Response } from "express";

class AdminController{
      getDashboardStats = (async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {

      })
    }

export const adminController = new AdminController();