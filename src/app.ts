import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config } from './config/config'
import { connectToDatabase, createDefaultAdmin } from './config/database'

import  authRoutes  from './routes/authRoutes'
import { adminRoutes } from './routes/adminRoutes'
import { stationRoutes } from './routes/stationRoutes'
import { paymentRoutes } from './routes/paymentRoutes'
import { subscriptionRoutes } from './routes/subscriptionRoutes'
import { packageRoutes } from './routes/packageRoutes'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'
// Import routes


const app = express()
app.use(express.json())

// // Create upload directories if they don't exist
// const uploadDirs = ['uploads', 'uploads/signatures', 'uploads/documents']
// uploadDirs.forEach((dir) => {
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true })
//   }
// })

// Security middleware (relax CSP so Swagger UI can render correctly)
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
})
app.use(limiter)

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/station', stationRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/packages', packageRoutes)
// Swagger docs
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
)
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})
// Initialize application
export const initializeApp = async (): Promise<void> => {
  try {
    // Connect to database
    await connectToDatabase()
    console.log('✅ Database connected successfully')

  // Ensure base roles exist
  // await ensureRolesExist()

    // Create default admin account
    await createDefaultAdmin()
    console.log('✅ Default admin account verified')

    console.log('✅ Application initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize application:', error)
    throw error
  }
}

export default app
