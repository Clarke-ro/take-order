import React from 'react';
import { LegalLayout } from '@/components/legal-layout';

export function RefundPolicyPage() {
  return (
    <LegalLayout
      title="Take Order — Refund & Cancellation Policy"
      subtitle="How cancellations and refunds are handled for Take Order seller subscription plans and for buyer purchases."
      lastUpdated="September 2026"
      activeTab="refunds"
    >
      <section className="space-y-8">
        <p className="text-base text-neutral-800 font-medium">
          This policy covers two separate kinds of payments on Take Order, and they work differently. Please read the section that applies to you.
        </p>

        {/* Part A */}
        <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
              Part A
            </span>
            <h2 className="text-xl font-bold text-neutral-900 mt-2">
              Take Order subscription plans (seller billing)
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              This section applies if you are a seller paying Take Order for a subscription plan. Take Order currently offers two tiers — Pro and Pro+ — each available on a Monthly or Annual billing cycle. Current pricing for each is shown at checkout and on our Pricing page.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">A1. Free trials</h3>
            <p>
              All current plans (Pro Monthly, Pro Annual, Pro+ Monthly, and Pro+ Annual) include a 7-day free trial. You will not be charged during the trial. If you do not cancel before the trial ends, your subscription automatically converts to a paid plan at that plan's listed price, and you will be charged at that time.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">A2. Cancelling your subscription</h3>
            <p>
              You can cancel a Monthly or Annual subscription, on either tier, at any time from the Subscription page in your account. Cancellation stops future billing; it does not retroactively refund the current billing period. You will keep access to your plan's features until the end of the period you've already paid for (or until the end of your trial, if you cancel during the trial).
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">A3. 14-Day Refund Guarantee</h3>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                We provide a full 14-day refund guarantee for all first-time Take Order Pro and Pro+ subscription payments. If you are not satisfied with the software for any reason, you may request a 100% refund within 14 days of your initial charge by contacting support@usetakeorder.app or directly through Paddle&apos;s buyer support portal at{' '}
                <a href="https://paddle.net" target="_blank" rel="noreferrer" className="underline font-semibold text-neutral-900">
                  paddle.net
                </a>.
              </li>
              <li>
                Approved refunds are processed back to your original payment method via our Merchant of Record, Paddle, and typically appear within 3–5 business days depending on your bank.
              </li>
              <li>
                <strong>Switching tiers:</strong> Upgrades and tier changes take effect immediately with billing adjusted according to provider guidelines.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">A4. Instant Digital Delivery</h3>
            <p>
              Take Order Pro and Pro+ subscriptions are digital software-as-a-service products. Access to paid features, expanded catalog limits, and premium analytics is delivered immediately to your account upon successful completion of checkout through Paddle.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">A5. Billing issues</h3>
            <p>
              If a renewal payment fails (for example, an expired card or insufficient funds), we provide a grace period before access is suspended, to give you a chance to update your payment method. The length of this grace period is shown in your account and billing provider settings.
            </p>
          </div>
        </div>

        {/* Part B */}
        <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
              Part B
            </span>
            <h2 className="text-xl font-bold text-neutral-900 mt-2">
              Orders between buyers and sellers (independent merchant sales)
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              This section applies to orders placed directly with an independent seller using a Take Order link.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B1. Take Order is not a party to this transaction
            </h3>
            <p>
              As set out in our Terms of Service, when a buyer places an order through a Take Order link, the contract of sale is between the buyer and the seller — not with Take Order. Take Order provides cloud software for inventory management and order communication; we do not process, touch, or route customer payments, nor do we manufacture, ship, warehouse, or guarantee the item or service being sold.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B2. Refunds, returns, and disputes for an order
            </h3>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                Refunds, exchanges, and cancellations for an order placed with a merchant are between the buyer and the seller, and are subject to whatever terms the seller has communicated for that sale.
              </li>
              <li>
                Take Order does not hold funds and does not mediate or guarantee the outcome of a dispute between a buyer and a seller.
              </li>
              <li>
                Any customer refunds for items purchased from a merchant must be requested directly from the seller through their agreed payment method.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B3. Deposits and reservations
            </h3>
            <p>
              Where an order was placed with a deposit or as a reservation, the terms of that deposit or reservation are set by the seller at the time the order link was created, and should be confirmed directly with the seller.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B4. Reporting a problem
            </h3>
            <p>
              If you believe a seller has acted fraudulently, or a transaction violates our Terms of Service, you can report it to us at the contact address below. We may investigate and take action against an account, including suspension.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="pt-2">
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            Contact &amp; Support
          </h2>
          <div className="mt-3 space-y-1.5 text-sm text-neutral-700">
            <p><strong>Platform:</strong> Take Order (https://usetakeorder.app)</p>
            <p><strong>Operator:</strong> Take Order Technologies</p>
            <p><strong>Physical Address:</strong> Accra, Greater Accra Region, Republic of Ghana</p>
            <p>
              <strong>Customer Support:</strong>{' '}
              <a
                href="mailto:support@usetakeorder.app"
                className="text-neutral-900 underline font-semibold hover:text-amber-600 transition-colors"
              >
                support@usetakeorder.app
              </a>{' '}
              / <a href="mailto:adjorloloclarke@gmail.com" className="text-neutral-900 underline">adjorloloclarke@gmail.com</a>
            </p>
            <p className="text-xs text-neutral-500 pt-1">
              For subscription refund requests, you may also reach out directly to Paddle at{' '}
              <a href="https://paddle.net" target="_blank" rel="noreferrer" className="underline font-semibold text-neutral-900">
                paddle.net
              </a>.
            </p>
          </div>
        </div>
      </section>
    </LegalLayout>
  );
}

export default RefundPolicyPage;
