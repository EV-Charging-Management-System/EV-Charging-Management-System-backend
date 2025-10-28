import { Router } from "express"
import {
  loginHandler,
  logoutHandler,
  PasswordChangeHandler,
  refreshAccessTokenHandler,
  registerHandler,
  registerBusinessHandler,
  getCurrentUserInfo,
} from "../controllers/authController"
import { authenticate } from "../middlewares/authMiddleware"

const router = Router()

// Public routess
router.post("/register", registerHandler)
router.post("/register-business", registerBusinessHandler)
router.post("/login", loginHandler)
router.post("/refresh-token", refreshAccessTokenHandler)
router.delete("/logout", authenticate, logoutHandler)

// Protected routes
router.put("/change-password", authenticate, PasswordChangeHandler)
router.get("/me", authenticate, getCurrentUserInfo)

export default router
