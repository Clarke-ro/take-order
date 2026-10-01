const pg = require("./node_modules/.pnpm/pg@8.23.0/node_modules/pg");

const passwords = [
  "Claar&$6000",
  "Claar%26%246000",
  "Claar&6000",
  "Claar$6000",
  "Claar6000",
  "claar&$6000",
  "claar&6000",
  "claar$6000",
  "claar6000",
];

async function tryPassword(pw) {
  const client = new pg.Client({
    user: "postgres.pzycvutijbvjktjrxmdn",
    password: pw,
    host: "aws-0-us-west-2.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    console.log("FOUND CORRECT PASSWORD:", pw);
    await client.end();
    return true;
  } catch (e) {
    // console.log("Failed:", pw, e.message);
    return false;
  }
}

async function run() {
  for (const pw of passwords) {
    if (await tryPassword(pw)) return;
  }
  console.log("None of the variations worked.");
}

run();
