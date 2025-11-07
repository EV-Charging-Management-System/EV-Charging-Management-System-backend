import { Router } from "express";
import { invoiceController } from "../controllers/invoiceController";

export const invoiceRoutes = Router();

// POST /api/invoice/create
invoiceRoutes.post("/create", invoiceController.create);
