import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Ensures all required PostgreSQL database tables and columns exist on server startup.
 * Uses idempotent `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
 * so existing databases are safely migrated without data loss.
 */
export async function ensureDatabaseSchema(database: typeof db): Promise<void> {
  try {
    logger.info("Verifying database schema tables and columns...");

    // 1. Ensure all base tables exist
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

      CREATE TABLE IF NOT EXISTS seller_settings (
        id serial PRIMARY KEY,
        owner_user_id text NOT NULL UNIQUE,
        settings jsonb NOT NULL DEFAULT '{}'
      );
    `);

    // 2. Ensure all columns exist on previously created tables (idempotent ALTER TABLE)
    await database.execute(sql`
      -- Products column migrations
      ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price numeric(12, 2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS cost numeric(12, 2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS variants text[] DEFAULT '{}';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS accent text DEFAULT '#0F6E6B';

      -- Backfill nulls for products
      UPDATE products SET image_urls = '{}' WHERE image_urls IS NULL;
      UPDATE products SET variants = '{}' WHERE variants IS NULL;
      UPDATE products SET preferences = '[]' WHERE preferences IS NULL;
      UPDATE products SET custom_fields = '[]' WHERE custom_fields IS NULL;
      UPDATE products SET stock = 0 WHERE stock IS NULL;
      UPDATE products SET accent = '#0F6E6B' WHERE accent IS NULL;
      UPDATE products SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL AND (image_urls IS NULL OR cardinality(image_urls) = 0);

      -- Orders column migrations
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_user_id text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2) DEFAULT '0';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_cost numeric(12, 2);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_amount numeric(12, 2);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS link_opens integer DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shares integer;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS likes integer;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS engagement_source text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference_image text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_details text;

      -- Order items column migrations
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source text DEFAULT 'catalog';
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku text;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS compare_at_price numeric(12, 2);
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS buyer_variant text;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS buyer_details text;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS reference_image text;

      -- Backfill nulls for order items
      UPDATE order_items SET image_urls = '{}' WHERE image_urls IS NULL;
      UPDATE order_items SET source = 'catalog' WHERE source IS NULL;
      UPDATE order_items SET quantity = 1 WHERE quantity IS NULL;
      UPDATE order_items SET position = 0 WHERE position IS NULL;

      -- Expenses column migrations
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_user_id text;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note text;

      -- Seller settings column migrations
      ALTER TABLE seller_settings ADD COLUMN IF NOT EXISTS owner_user_id text;
      ALTER TABLE seller_settings ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

      -- Ensure indices exist
      CREATE INDEX IF NOT EXISTS products_owner_user_id_idx ON products(owner_user_id);
      CREATE INDEX IF NOT EXISTS orders_owner_user_id_idx ON orders(owner_user_id);
      CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
      CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
      CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
      CREATE INDEX IF NOT EXISTS expenses_owner_user_id_idx ON expenses(owner_user_id);
      CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON expenses(expense_date);
    `);

    logger.info("Database schema tables and columns verified successfully.");
  } catch (err: unknown) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Database schema verification warning (database may be unreachable or will initialize on first query)."
    );
  }
}
