<<<<<<< Updated upstream
import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { config } from "./config/config"
import { connectToDatabase, createDefaultAdmin } from "./config/database"

import authRoutes from "./routes/authRoutes"
import { adminRoutes } from "./routes/adminRoutes"
import { stationRoutes } from "./routes/stationRoutes"
import { companyRoutes } from "./routes/companyRoutes"
import { packageRoutes } from './routes/packageRoutes'
import { subscriptionRoutes } from './routes/subscriptionRoutes'
import { userRoutes } from './routes/userRoutes'
import { bookingRoutes } from "./routes/bookingRoutes"
import { paymentRoutes } from "./routes/paymentRoutes"
import { membershipRoutes } from "./routes/membershipRoutes"
import { chargingSessionRoutes } from "./routes/chargingSessionRoutes"
import { vehicleRoutes } from "./routes/vehicleRoutes"
import { staffRoutes } from "./routes/staffRoutes"
import { vnpayRoutes } from "./routes/vnpayRoutes"
import { businessRoutes } from "./routes/businessRoutes"
const app = express()
app.use(express.json())

// Security middleware
app.use(helmet())

// Rate limiting
=======
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config/config";
import { connectToDatabase, createDefaultAdmin } from "./config/database";

// ✅ Import routes
import authRoutes from "./routes/authRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { stationRoutes } from "./routes/stationRoutes";
import { companyRoutes } from "./routes/companyRoutes";
import { packageRoutes } from "./routes/packageRoutes";
import { subscriptionRoutes } from "./routes/subscriptionRoutes";
import { userRoutes } from "./routes/userRoutes";
import { bookingRoutes } from "./routes/bookingRoutes";
import { paymentRoutes } from "./routes/paymentRoutes";
import { membershipRoutes } from "./routes/membershipRoutes";
import { chargingSessionRoutes } from "./routes/chargingSessionRoutes";
import { vehicleRoutes } from "./routes/vehicleRoutes";
import { staffRoutes } from "./routes/staffRoutes";
import { vnpayRoutes } from "./routes/vnpayRoutes";
import { businessRoutes } from "./routes/businessRoutes"; // ✅ mới thêm

const app = express();
app.use(express.json());

// 🛡️ Security middleware
app.use(helmet());

// 🚦 Rate limiting
>>>>>>> Stashed changes
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
<<<<<<< Updated upstream
})
app.use(limiter)

// CORS configuration
=======
});
app.use(limiter);

// 🌐 CORS configuration
>>>>>>> Stashed changes
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
<<<<<<< Updated upstream
  }),
)

app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/station", stationRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/packages', packageRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/users', userRoutes)
app.use("/api/booking", bookingRoutes)
app.use("/api/payment", paymentRoutes)
app.use("/api/membership", membershipRoutes)
app.use("/api/charging-session", chargingSessionRoutes)
app.use("/api/vehicle", vehicleRoutes)
app.use("/api/company", companyRoutes)
app.use("/api/staff", staffRoutes)
app.use("/api/vnpay", vnpayRoutes)
app.use("/api/business", businessRoutes)
// Initialize application
export const initializeApp = async (): Promise<void> => {
  try {
    // Connect to database
    await connectToDatabase()
    console.log("✅ Database connected successfully")

    // Create default admin account
    await createDefaultAdmin()
    console.log("✅ Default admin account verified")

    console.log("✅ Application initialized successfully")
  } catch (error) {
    console.error("❌ Failed to initialize application:", error)
    throw error
  }
}

export default app
=======
  })
);

// 🚀 API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/station", stationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/charging-session", chargingSessionRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/company", companyRoutes); // ⚠️ trùng với /api/companies — có thể bỏ 1 cái
app.use("/api/staff", staffRoutes);
app.use("/api/vnpay", vnpayRoutes);
app.use("/api/business", businessRoutes); // ✅ thêm mới

// 🟢 Initialize application
export const initializeApp = async (): Promise<void> => {
  try {
    await connectToDatabase();
    console.log("✅ Database connected successfully");

    await createDefaultAdmin();
    console.log("✅ Default admin account verified");

    console.log("✅ Application initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize application:", error);
    throw error;
  }
};

export default app;
>>>>>>> Stashed changes
