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
            <h3 className="text-base font-bold text-neutral-900 mb-1">A3. Refunds</h3>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                Charges already processed for Pro or Pro+ (Monthly or Annual) are generally non-refundable, except where required by law or where we determine, at our discretion, that a refund is appropriate (for example, a billing error or duplicate charge).
              </li>
              <li>
                Refund requests should be sent to the contact address below. Approved refunds are processed back to your original payment method through our billing provider (RevenueCat, via Stripe or Paddle) and may take several business days to appear, depending on your bank or mobile money provider.
              </li>
              <li>
                <strong>Switching tiers:</strong> Upgrades and tier changes take effect immediately with billing adjusted according to provider guidelines.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">A4. Billing issues</h3>
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
              Orders between buyers and sellers (marketplace transactions)
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              This section applies to a purchase you made or received through a Take Order link.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B1. Take Order is not a party to this transaction
            </h3>
            <p>
              As set out in our Terms of Service, when a buyer completes an order through a Take Order link, the contract of sale is between the buyer and the seller — not with Take Order. Take Order provides the order-link and payment-routing tool; we do not manufacture, ship, warehouse, or guarantee the item or service being sold.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B2. Refunds, returns, and disputes for an order
            </h3>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                Refunds, exchanges, and cancellations for a specific order are between the buyer and the seller, and are subject to whatever terms the seller has communicated for that sale.
              </li>
              <li>
                Take Order does not currently mediate or guarantee the outcome of a dispute between a buyer and a seller.
              </li>
              <li>
                If a payment was made through an integrated payment provider (such as Paystack, once live) and needs to be reversed, that reversal is subject to the payment provider's own refund and dispute process. Sellers are responsible for honoring reasonable, good-faith refund requests where a good or service was not delivered as agreed.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B3. Deposits and reservations
            </h3>
            <p>
              Where an order was placed with a deposit or as a reservation (with no payment collected upfront), the terms of that deposit or reservation — including whether it is refundable if the buyer or seller cancels — are set by the seller at the time the order link was created, and should be confirmed directly with the seller.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              B4. Reporting a problem
            </h3>
            <p>
              If you believe a seller has acted fraudulently, or a transaction violates our Terms of Service, you can report it to us at the contact address below. We may investigate and take action against an account, including suspension, but this does not guarantee a refund of the underlying transaction — that remains between you and the seller.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="pt-2">
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            Contact
          </h2>
          <p className="mt-3">
            Questions about billing, cancellations, or a transaction dispute can be sent to:{' '}
            <a
              href="mailto:adjorloloclarke@gmail.com"
              className="text-neutral-900 underline font-semibold hover:text-amber-600 transition-colors"
            >
              adjorloloclarke@gmail.com
            </a>
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}

export default RefundPolicyPage;
