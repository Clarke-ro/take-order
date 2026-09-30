import React from 'react';
import { LegalLayout } from '@/components/legal-layout';

export function TermsPage() {
  return (
    <LegalLayout
      title="Take Order — Terms of Service"
      subtitle="These Terms of Service govern your access to and use of Take Order's catalog, order links, and seller tools."
      lastUpdated="September 2026"
      activeTab="terms"
    >
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            1. Who this agreement is with, and who it covers
          </h2>
          <p>
            These Terms of Service ("Terms") are a contract between you and Take Order ("Take Order," "we," "us"), governing your use of the Take Order platform, website, and any related applications (the "Service"). By creating an account or using the Service, you agree to these Terms.
          </p>
          <p className="mt-3">Take Order has two kinds of users:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Sellers</strong> — people who use Take Order to catalog products, generate order links, and manage their sales.
            </li>
            <li>
              <strong>Buyers</strong> — people who receive a Take Order link from a seller and use it to place and pay for an order.
            </li>
          </ul>
          <p className="mt-3">
            Some sections of these Terms apply to sellers, some to buyers, and some to both — each section says which.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            2. Eligibility
          </h2>
          <p>
            You must be at least 18 years old, or the age of legal majority in your jurisdiction if higher, to create a seller account or to enter into a purchase as a buyer. By using the Service, you confirm that you meet this requirement and that you have the legal capacity to enter into this agreement.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            3. What Take Order is — and what it is not
          </h2>
          <p>
            Take Order is a tool, not the seller, and not a payment processor. This distinction matters and governs several sections below:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>
              Take Order provides sellers with a catalog manager, an order-link generator, and business analytics. Take Order is not a party to the sale between a seller and a buyer.
            </li>
            <li>
              Take Order does not hold, custody, or transmit buyer or seller funds itself. All payment processing for orders is handled by licensed third-party payment providers (currently, or in future, including Paystack). All subscription billing for Take Order's own seller plans is handled by licensed third-party billing providers (currently RevenueCat, using Stripe and/or Paddle as the underlying processor). Your use of those payment features is also subject to those providers' own terms.
            </li>
            <li>
              Take Order does not read, monitor, or access sellers' personal messaging accounts (WhatsApp, Instagram, TikTok, Snapchat, or any other platform). Sellers choose what information to enter into Take Order themselves; nothing is collected from their personal conversations.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            4. Seller accounts
          </h2>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>You are responsible for the accuracy of the information in your account, your product catalog, and any order links you create.</li>
            <li>You are responsible for keeping your account credentials secure and for all activity that occurs under your account.</li>
            <li>
              You are solely responsible for fulfilling orders you accept, for the accuracy of your product listings (including price, availability, and description), and for complying with any laws applicable to the goods or services you sell, including consumer protection, product safety, and tax obligations in your jurisdiction.
            </li>
            <li>
              You may not list or offer for sale anything illegal under the laws of Ghana or of the buyer's jurisdiction, including but not limited to: counterfeit or stolen goods, weapons or ammunition, controlled or illicit substances, items that infringe on another person's intellectual property, or anything else prohibited by applicable law.
            </li>
            <li>
              Take Order may suspend or terminate an account that violates this section, misuses the Service, or is used for fraud.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            5. Buyer use of order links
          </h2>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>
              When you complete an order through a Take Order link, you are entering into a purchase agreement directly with the seller, not with Take Order.
            </li>
            <li>
              Take Order is not responsible for the quality, safety, legality, delivery, or accuracy of any item or service sold by a seller. Any dispute regarding an order — including non-delivery, damaged goods, or disagreement over what was agreed — is between you and the seller.
            </li>
            <li>
              You are responsible for reviewing the order details (item, price, payment terms) before completing payment.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            6. Subscriptions and billing (seller plans)
          </h2>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>
              Take Order offers optional paid subscription tiers for sellers (currently Pro and Pro+), each available on a monthly or annual billing cycle. Current plans, pricing, and billing frequency are shown at checkout and on our Pricing page, which may be updated from time to time as described below.
            </li>
            <li>
              Free trials, where offered, convert automatically into a paid subscription at the end of the trial period unless cancelled before the trial ends. You will not be charged during an active trial. The length of any trial is shown to you before you start it.
            </li>
            <li>
              Subscriptions renew automatically at the end of each billing period unless cancelled beforehand. You can cancel at any time through your account's subscription management page; cancellation takes effect at the end of the current billing period, and you retain access until then.
            </li>
            <li>
              Billing, payment method management, and receipts for subscriptions are handled by our billing provider (RevenueCat, and the underlying processor — Stripe or Paddle, depending on your region and how the platform is configured at the time). Refunds for subscription charges are governed by our separate Refund &amp; Cancellation Policy.
            </li>
            <li>
              We may change subscription pricing with advance notice; changes will not apply retroactively to an already-paid billing period.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            7. Acceptable use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>Use the Service for any unlawful purpose, or to facilitate an unlawful transaction</li>
            <li>Attempt to interfere with, disrupt, or gain unauthorized access to the Service or its infrastructure</li>
            <li>Misrepresent your identity, your business, or the products you sell</li>
            <li>Use the Service to send unsolicited bulk messages or spam</li>
            <li>Reverse-engineer, scrape, or copy the Service except as permitted by law</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            8. Intellectual property
          </h2>
          <p>
            The Take Order name, branding, and the Service itself (excluding content you provide, such as your product listings and photos) belong to Take Order. You retain ownership of the content you upload, but grant Take Order a license to host, display, and process that content as necessary to operate the Service on your behalf.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            9. Disclaimers
          </h2>
          <p>
            The Service is provided "as is" and "as available." To the fullest extent permitted by law, Take Order disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that the Service will be uninterrupted, error-free, or secure at all times.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            10. Limitation of liability
          </h2>
          <p>
            To the fullest extent permitted by applicable law, Take Order's total liability arising out of or relating to these Terms or the Service is limited to the greater of (a) the amount you paid Take Order in subscription fees in the twelve months before the claim arose, or (b) an amount to be specified, whichever a lawyer advises is appropriate for a business of this stage. Take Order is not liable for indirect, incidental, or consequential damages, or for any dispute between a buyer and a seller.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            11. Indemnification
          </h2>
          <p>
            You agree to indemnify and hold Take Order harmless from any claim, loss, or damage arising from your use of the Service, your violation of these Terms, or your violation of any law or the rights of a third party, including disputes arising from products or services you sold or purchased through the Service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            12. Termination
          </h2>
          <p>
            We may suspend or terminate your account for violation of these Terms, suspected fraud, or extended inactivity, with notice where reasonably possible. You may close your account at any time from your account settings; see the Privacy Policy for what happens to your data afterward.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            13. Changes to these Terms
          </h2>
          <p>
            We may update these Terms from time to time. We will provide notice of material changes (for example, by email or an in-app notice) before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            14. Governing law and disputes
          </h2>
          <p>
            These Terms are governed by the laws of the Republic of Ghana. Any dispute arising from these Terms or the Service will first be attempted to be resolved informally by contacting us at the address below; [insert a chosen dispute resolution mechanism — arbitration, courts of Ghana, etc. — once confirmed with a lawyer].
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            15. Contact
          </h2>
          <p>
            Questions about these Terms can be sent to:{' '}
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

export default TermsPage;
