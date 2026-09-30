import React from 'react';
import { LegalLayout } from '@/components/legal-layout';

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Take Order — Privacy Policy"
      subtitle="How Take Order collects, uses, protects, and handles personal data in compliance with Ghana's Data Protection Act, 2012 (Act 843)."
      lastUpdated="September 2026"
      activeTab="privacy"
    >
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            1. Who we are
          </h2>
          <p>
            Take Order ("we," "us," "our") operates a platform that helps sellers manage a product catalog, generate order links, and track their sales. This policy explains what personal data we collect, why, and what rights you have over it, in line with Ghana's Data Protection Act, 2012 (Act 843).
          </p>
          <p className="mt-3">
            Under Act 843, Take Order acts as a data controller for the account, catalog, and order data described below, and we are in the process of registering with Ghana's Data Protection Commission as required by law.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            2. What data we collect
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                From sellers (account holders):
              </h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Name, email address, and phone number provided at sign-up</li>
                <li>Business name, category, and store settings</li>
                <li>Product catalog data you enter (names, prices, costs, stock levels, photos)</li>
                <li>Order and transaction records generated through your use of the Service</li>
                <li>
                  Subscription and billing status (the billing details themselves — card numbers, mobile money numbers — are collected and held by our billing provider, not by us; see Section 4)
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                From buyers (people completing an order link):
              </h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Name and phone number, entered at checkout</li>
                <li>A reference photo, if you choose to upload one to clarify what you're ordering</li>
                <li>Delivery address or pickup preference, if applicable</li>
                <li>Order details (item, price, quantity, payment status)</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-neutral-800 text-sm">
              <strong>We do not collect this data from your personal chat accounts.</strong> Take Order never connects to, reads, or accesses a seller's WhatsApp, Instagram, TikTok, Snapchat, or any other personal messaging account. Every piece of information above is entered directly into Take Order by the seller or buyer themselves.
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                Automatically collected data:
              </h3>
              <p className="mt-1">
                Basic technical data (IP address, browser type, device type) for security, fraud prevention, and to auto-detect your local currency at sign-up. This is not used to identify you personally beyond these purposes.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            3. Why we collect it, and our legal basis
          </h2>
          <p>
            In line with Act 843's principle of purpose specification, each category of data above is collected only for a specific, disclosed reason:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>To create and operate your account (necessary to provide the Service you've requested)</li>
            <li>To generate and operate order links and track sales (necessary to provide the Service)</li>
            <li>To detect your local currency and language (to make the Service usable for you)</li>
            <li>To bill you for a subscription, if you choose one (necessary to fulfil that contract)</li>
            <li>To prevent fraud and keep the platform secure (a legitimate interest, balanced against your rights)</li>
            <li>To comply with our own legal obligations, including under Act 843 itself</li>
          </ul>
          <p className="mt-3">
            We do not sell your personal data to third parties, and we do not use it for purposes beyond what's described here without asking you first.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            4. Who we share data with
          </h2>
          <p>
            We share data only where necessary to operate the Service, with the following categories of service providers (sub-processors), each bound by their own data protection obligations:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li><strong>Clerk</strong> — authentication and account management</li>
            <li><strong>Supabase</strong> — database and file storage</li>
            <li>
              <strong>RevenueCat</strong>, and the underlying billing processor it uses (Stripe and/or Paddle) — subscription billing; they, not Take Order, hold your card or payment details
            </li>
            <li>
              <strong>Paystack</strong> (once integrated) — order payment processing; they, not Take Order, hold buyer payment details
            </li>
            <li>Our hosting and infrastructure providers, as necessary to run the Service</li>
          </ul>
          <p className="mt-3">
            We do not share your personal data with unrelated third parties for their own marketing purposes.
          </p>
          <p className="mt-2 font-medium text-neutral-900">
            A seller's data is never visible to another seller. Each seller's catalog, orders, and business data are isolated from every other seller on the platform.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            5. International data transfers
          </h2>
          <p>
            Some of our service providers process data outside Ghana. Where personal data originating in Ghana is processed abroad, we require that it be handled consistently with Act 843's protections, as required by Section 45 of the Act for cross-border processing.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            6. How long we keep your data
          </h2>
          <p>
            We retain account and order data for as long as your account is active, and for a reasonable period afterward as needed for legal, tax, or dispute-resolution purposes. You can request deletion of your account and data at any time (see Section 7); some records may be retained longer where required by law (for example, transaction records relevant to a tax obligation).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            7. Your rights
          </h2>
          <p>
            Under Act 843, and as a matter of our own policy regardless of where you're located, you have the right to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate or incomplete data</li>
            <li>Object to certain processing, including for direct marketing</li>
            <li>Request deletion of your account and associated personal data, subject to Section 6</li>
            <li>Lodge a complaint with Ghana's Data Protection Commission if you believe your rights under Act 843 have been violated</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at the address in Section 11.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            8. Data security
          </h2>
          <p>
            We apply reasonable technical and organizational safeguards to protect your data, consistent with Act 843's data security safeguards principle, including access controls that keep each seller's data isolated, secure storage through our infrastructure providers, and encrypted transmission of data. No system is perfectly secure, and we will notify affected users and the Data Protection Commission without undue delay in the event of a data breach affecting personal data, as required by law.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            9. Children's privacy
          </h2>
          <p>
            The Service is not directed at, and is not intended for use by, anyone under 18. We do not knowingly collect personal data from minors. If we learn that we have, we will delete it.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            10. Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. We will provide notice of material changes before they take effect.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            11. Contact us
          </h2>
          <p>
            For questions about this policy, or to exercise your rights over your personal data, contact us at:{' '}
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

export default PrivacyPage;
