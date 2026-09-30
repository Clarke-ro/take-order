import { pool } from "@workspace/db";

const INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS orders_owner_user_id_idx ON orders(owner_user_id);",
  "CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);",
  "CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);",
  "CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);",
  "CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);",
  "CREATE INDEX IF NOT EXISTS products_owner_user_id_idx ON products(owner_user_id);",
  "CREATE INDEX IF NOT EXISTS expenses_owner_user_id_idx ON expenses(owner_user_id);",
  "CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON expenses(expense_date);",
];

async function main() {
  console.log("Applying performance indexes to active database...");
  for (const sql of INDEX_STATEMENTS) {
    const start = Date.now();
    await pool.query(sql);
    const duration = Date.now() - start;
    console.log(`✓ Executed: ${sql.trim()} (${duration}ms)`);
  }

  // Verify created indexes
  const res = await pool.query(
    "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;"
  );
  console.log("\nVerified indexes now present in DB:");
  for (const row of res.rows) {
    console.log(` - ${row.tablename}: ${row.indexname}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to apply indexes:", err);
  process.exit(1);
});
