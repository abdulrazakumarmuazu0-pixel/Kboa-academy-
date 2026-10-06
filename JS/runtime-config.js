/* KBOA runtime configuration.
 * This file is safe to commit only with placeholders. Set the real public
 * Paystack key during deployment without ever placing the secret key here.
 */
window.KBOA_RUNTIME_CONFIG = Object.assign({
  environment: 'production',
  paystackPublicKey: 'pk_live_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY'
}, window.KBOA_RUNTIME_CONFIG || {});
