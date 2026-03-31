export { getStripe, createDepositCheckout, calculateDeposit } from './stripe';

/**
 * Payment Integration Roadmap
 *
 * 1. STRIPE (Primary payment processor)
 *    - 10% deposit collection via Stripe Checkout
 *    - Supabase Edge Function creates checkout sessions
 *    - Webhook confirms payment and updates customer_project.deposit_paid
 *    - Status: SDK installed, groundwork in place
 *
 * 2. REVENUECAT (Subscription management - future)
 *    - Painter monthly subscription plans (basic, pro, enterprise)
 *    - Handles App Store / Play Store subscriptions via Capacitor
 *    - npm install @revenuecat/purchases-js
 *    - Status: Not yet implemented
 *
 * 3. APPLE WALLET (Payment receipts - future)
 *    - Generate Apple Wallet passes for deposit receipts
 *    - Show project details, painter info, scheduled date
 *    - Requires Apple Developer account + pass signing certificate
 *    - Status: Not yet implemented
 */
