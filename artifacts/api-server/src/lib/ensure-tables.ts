import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Ensures all required PostgreSQL database tables exist on server startup.
 * Uses idempotent `CREATE TABLE IF NOT EXISTS` so it is safe to run repeatedly.
 */
export async function ensureDatabaseSchema(database: typeof db): Promise<void> {
  try {
    logger.info("Verifying database schema tables...");

    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id serial PRIMARY KEY,
        owner_user_id text,
        name text NOT NULL,
        category text NOT NULL,
        sku text,
        description text,
        price numeric(12, 2) NOT NULL,
        compare_at_price numeric(12, 2),
        cost numeric(12, 2),
        stock integer NOT NULL DEFAULT 0,
        variants text[] NOT NULL DEFAULT '{}',
        preferences jsonb NOT NULL DEFAULT '[]',
        custom_fields jsonb NOT NULL DEFAULT '[]',
        image_url text,
        image_urls text[] NOT NULL DEFAULT '{}',
        accent text NOT NULL DEFAULT '#0F6E6B'
      );

      CREATE INDEX IF NOT EXISTS products_owner_user_id_idx ON products(owner_user_id);

      CREATE TABLE IF NOT EXISTS orders (
        id serial PRIMARY KEY,
        owner_user_id text,
        token text NOT NULL UNIQUE,
        product_id integer NOT NULL,
        product_name text NOT NULL,
        customer_name text NOT NULL DEFAULT 'Waiting for buyer',
        customer_phone text,
        channel text NOT NULL,
        amount numeric(12, 2) NOT NULL,
        delivery_fee numeric(12, 2) NOT NULL DEFAULT '0',
        delivery_method text,
        delivery_address text,
        product_cost numeric(12, 2),
        deposit_amount numeric(12, 2),
        payment_mode text NOT NULL,
        status text NOT NULL DEFAULT 'reserved',
        fulfillment text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        link_opens integer NOT NULL DEFAULT 0,
        shares integer,
        likes integer,
        engagement_source text,
        reference_image text,
        buyer_details text
      );

      CREATE INDEX IF NOT EXISTS orders_owner_user_id_idx ON orders(owner_user_id);
      CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
      CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

      CREATE TABLE IF NOT EXISTS order_items (
        id serial PRIMARY KEY,
        order_id integer NOT NULL,
        product_id integer NOT NULL,
        product_name text NOT NULL,
        source text NOT NULL DEFAULT 'catalog',
        sku text,
        description text,
        compare_at_price numeric(12, 2),
        image_urls text[] NOT NULL DEFAULT '{}',
        amount numeric(12, 2) NOT NULL,
        quantity integer NOT NULL DEFAULT 1,
        position integer NOT NULL DEFAULT 0,
        buyer_variant text,
        buyer_details text,
        reference_image text
      );

      CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);

      CREATE TABLE IF NOT EXISTS expenses (
        id serial PRIMARY KEY,
        owner_user_id text,
        title text NOT NULL,
        category text NOT NULL,
        amount numeric(12, 2) NOT NULL,
        expense_date date NOT NULL,
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS expenses_owner_user_id_idx ON expenses(owner_user_id);
      CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON expenses(expense_date);

      CREATE TABLE IF NOT EXISTS seller_settings (
        id serial PRIMARY KEY,
        owner_user_id text NOT NULL UNIQUE,
        settings jsonb NOT NULL DEFAULT '{}'
      );
    `);

    logger.info("Database schema tables verified successfully.");
  } catch (err: unknown) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Database schema verification warning (database may be unreachable or will initialize on first query)."
    );
  }
}
