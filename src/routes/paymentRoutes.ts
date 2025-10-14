import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware'
import { createPayment, vnpayIpn, vnpayReturn } from '../controllers/paymentController'

const router = Router()

/**
 * @openapi
 * /payment/create:
 *   post:
 *     tags: [Payment]
 *     summary: Create a VNPay payment URL
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, orderInfo]
 *             properties:
 *               amount:
 *                 type: number
 *               orderInfo:
 *                 type: string
 *               bankCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment URL
 */
router.post('/create', authenticate, createPayment)

/**
 * @openapi
 * /payment/vnpay-return:
 *   get:
 *     tags: [Payment]
 *     summary: VNPay return URL handler
 *     description: Called by VNPay after user completes payment. For testing, paste the exact query string from the generated paymentUrl. Only include these minimal fields used for signing.
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema: { type: string, example: '10000000' }
 *       - in: query
 *         name: vnp_BankCode
 *         schema: { type: string, example: 'VNBANK' }
 *       - in: query
 *         name: vnp_Command
 *         schema: { type: string, example: 'pay' }
 *       - in: query
 *         name: vnp_CreateDate
 *         schema: { type: string, example: '20251014123318' }
 *       - in: query
 *         name: vnp_CurrCode
 *         schema: { type: string, example: 'VND' }
 *       - in: query
 *         name: vnp_IpAddr
 *         schema: { type: string, example: '::1' }
 *       - in: query
 *         name: vnp_Locale
 *         schema: { type: string, example: 'vn' }
 *       - in: query
 *         name: vnp_OrderInfo
 *         schema: { type: string, example: 'Nap tien EV' }
 *       - in: query
 *         name: vnp_OrderType
 *         schema: { type: string, example: 'other' }
 *       - in: query
 *         name: vnp_ReturnUrl
 *         schema: { type: string, example: 'http://localhost:5000/api/payment/vnpay-return' }
 *       - in: query
 *         name: vnp_TmnCode
 *         schema: { type: string, example: '' }
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string, example: '1760419998112' }
 *       - in: query
 *         name: vnp_Version
 *         schema: { type: string, example: '2.1.0' }
 *       - in: query
 *         name: vnp_SecureHash
 *         required: true
 *         schema: { type: string, example: 'feae02d1...bf157bef25910' }
 *     responses:
 *       200:
 *         description: Return data
 */
router.get('/vnpay-return', vnpayReturn)

/**
 * @openapi
 * /payment/vnpay-ipn:
 *   get:
 *     tags: [Payment]
 *     summary: VNPay IPN listener
 *     description: VNPay server-to-server notification. For testing, you can reuse the same minimal fields as return. In production, VNPay usually includes more fields (e.g., vnp_ResponseCode).
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema: { type: string, example: '10000000' }
 *       - in: query
 *         name: vnp_BankCode
 *         schema: { type: string, example: 'VNBANK' }
 *       - in: query
 *         name: vnp_Command
 *         schema: { type: string, example: 'pay' }
 *       - in: query
 *         name: vnp_CreateDate
 *         schema: { type: string, example: '20251014123318' }
 *       - in: query
 *         name: vnp_CurrCode
 *         schema: { type: string, example: 'VND' }
 *       - in: query
 *         name: vnp_IpAddr
 *         schema: { type: string, example: '::1' }
 *       - in: query
 *         name: vnp_Locale
 *         schema: { type: string, example: 'vn' }
 *       - in: query
 *         name: vnp_OrderInfo
 *         schema: { type: string, example: 'Nap tien EV' }
 *       - in: query
 *         name: vnp_OrderType
 *         schema: { type: string, example: 'other' }
 *       - in: query
 *         name: vnp_TmnCode
 *         schema: { type: string, example: '' }
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string, example: '1760419998112' }
 *       - in: query
 *         name: vnp_Version
 *         schema: { type: string, example: '2.1.0' }
 *       - in: query
 *         name: vnp_SecureHash
 *         required: true
 *         schema: { type: string, example: 'feae02d1...bf157bef25910' }
 *     responses:
 *       200:
 *         description: IPN response
 */
router.get('/vnpay-ipn', vnpayIpn)

export { router as paymentRoutes }
