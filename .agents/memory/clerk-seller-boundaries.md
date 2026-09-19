---
name: Clerk seller boundaries
description: Durable auth and ownership rules for the seller API.
---

Seller authentication must be attached to each seller route (or an explicitly seller-only path mount), not to a pathless router that also receives public buyer-token requests. Ownership filters must use the authenticated Clerk user ID on every seller read and write.

**Why:** A pathless Express router middleware runs before route matching and can accidentally reject public buyer links; nullable legacy ownership must not be auto-claimed by the first authenticated seller.

**How to apply:** Keep buyer-token routes outside the seller-auth boundary. Treat rows with no owner as inaccessible to authenticated seller queries until an explicit migration or claim flow assigns ownership.