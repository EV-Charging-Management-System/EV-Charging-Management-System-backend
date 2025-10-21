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
 *     description: VNPay redirect sau khi thanh toan. De test, nen dán nguyen query ma VNPay tra ve. Neu tu dien, hay nhap cac truong can thiet ben duoi dung voi du lieu VNPay.
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema: { type: string, example: '20000000' }
 *       - in: query
 *         name: vnp_TmnCode
 *         schema: { type: string, example: 'XSRK7UCV' }
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string, example: '1760422963193' }
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema: { type: string, example: '00' }
 *       - in: query
 *         name: vnp_SecureHash
 *         required: true
 *         schema: { type: string, example: '7964d574...c3487d8' }
 *       - in: query
 *         name: vnp_BankCode
 *         schema: { type: string, example: 'NCB' }
 *       - in: query
 *         name: vnp_OrderInfo
 *         schema: { type: string, example: 'Nap tien EV' }
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
 *     description: VNPay server to server notification. De test tren local, co the dung y nguyen bo query nhu o return.
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema: { type: string, example: '20000000' }
 *       - in: query
 *         name: vnp_TmnCode
 *         schema: { type: string, example: 'XSRK7UCV' }
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string, example: '1760422963193' }
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema: { type: string, example: '00' }
 *       - in: query
 *         name: vnp_SecureHash
 *         required: true
 *         schema: { type: string, example: '7964d574...c3487d8' }
 *       - in: query
 *         name: vnp_BankCode
 *         schema: { type: string, example: 'NCB' }
 *       - in: query
 *         name: vnp_OrderInfo
 *         schema: { type: string, example: 'Nap tien EV' }
 *     responses:
 *       200:
 *         description: IPN response
 */
router.get('/vnpay-ipn', vnpayIpn)

export { router as paymentRoutes }
