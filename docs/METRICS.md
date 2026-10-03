# Canonical Metric Definitions & Financial Formulas

This document establishes the single source of truth for all financial, operational, and channel metrics across the Take Order platform. These definitions are strictly implemented in both `@workspace/api-server` (backend analytics) and `@workspace/take-order` (frontend dashboard & exports).

---

## 1. Core Metric Definitions

### 1.1 Total Order Value
- **Definition**: The gross aggregate value of all valid orders placed within the selected reporting window, regardless of whether payment has settled.
- **Formula**:
  $$\text{Order Value} = \sum_{o \in \text{Orders}} o.\text{amount}$$
  *(Excludes draft/link-generation placeholders with status `'reserved'` and cancelled orders).*
- **Unit**: Currency (seller's configured store currency, e.g., GHS, NGN, KES, USD).

### 1.2 Revenue (Collected Cash)
- **Definition**: Total cash payments actually collected from buyers within the period, bucketed by payment date in the seller's local timezone.
- **Formula**:
  $$\text{Revenue} = \sum_{o \in \text{Orders}} \begin{cases} 
  o.\text{amount} & \text{if } o.\text{status} = \text{'paid'} \\
  o.\text{depositAmount} & \text{if } o.\text{status} = \text{'deposit\_paid'} \\
  0 & \text{otherwise}
  \end{cases}$$
- **Key distinction**: Revenue represents realized cash in hand. Unpaid/pending orders do **not** contribute to revenue until settled.

### 1.3 Outstanding Balance
- **Definition**: The remaining uncollected balance on all open orders placed in the reporting window.
- **Formula**:
  $$\text{Outstanding} = \sum_{o \in \text{OpenOrders}} \begin{cases}
  \max(0, o.\text{amount} - o.\text{depositAmount}) & \text{if } o.\text{status} = \text{'deposit\_paid'} \\
  o.\text{amount} & \text{if } o.\text{status} \in \{\text{'pending'}, \text{'unpaid'}\} \\
  0 & \text{otherwise}
  \end{cases}$$
- **Invariant**:
  $$\text{Order Value} = \text{Revenue} + \text{Outstanding} \quad (\text{for all non-cancelled orders in period})$$

### 1.4 Total Orders Placed
- **Definition**: Count of unique orders placed by buyers in the period.
- **Formula**: Count of orders where $o.\text{status} \notin \{\text{'reserved'}, \text{'cancelled'}\}$.

### 1.5 Average Order Value (AOV)
- **Definition**: Average basket size across all placed orders in the period.
- **Formula**:
  $$\text{AOV} = \frac{\text{Order Value}}{\text{Total Orders}}$$
- **Rule**: Never compute AOV by dividing collected revenue by total orders, as that conflates uncollected cash with order volume.

### 1.6 Cost of Goods Sold (COGS) & Missing Cost Warning
- **Definition**: The acquisition or manufacturing cost of products for orders that generated revenue in the period.
- **Formula**:
  $$\text{COGS} = \sum_{o \in \text{PaidOrders}} \text{Cost}(o)$$
  Where $\text{Cost}(o)$ uses the captured order product cost ($o.\text{productCost}$) if recorded at sale time, falling back to the current catalog cost ($p.\text{cost}$).
- **Missing Costs Rule**: If any product has no cost set (`cost === null` or `cost === undefined`), the system must **never silently assume zero**. It must surface a prominent `"Missing costs"` alert linking directly to the catalog item edit page.

### 1.7 Operating Expenses (OpEx)
- **Definition**: Recorded non-inventory business expenses in the period (rent, marketing/ads, packaging, dispatch fees, utilities).
- **Formula**:
  $$\text{OpEx} = \sum_{e \in \text{Expenses}} e.\text{amount}$$

### 1.8 Net Profit & Net Margin
- **Definition**: The net monetary return after deducting cost of goods and operating expenses from collected revenue.
- **Formula**:
  $$\text{Net Profit} = \text{Revenue} - \text{COGS} - \text{OpEx}$$
  $$\text{Net Margin} = \frac{\text{Net Profit}}{\text{Revenue}} \times 100\% \quad (\text{if Revenue} > 0)$$
- **Gross Margin**:
  $$\text{Gross Margin} = \frac{\text{Revenue} - \text{COGS}}{\text{Revenue}} \times 100\%$$

### 1.9 Repeat Clients
- **Definition**: The percentage of unique customers in the reporting period who have placed more than one order.
- **Formula**:
  $$\text{Repeat Client Rate} = \frac{|\{c \in \text{Customers} \mid \text{OrderCount}(c) > 1\}|}{|\text{Customers}|} \times 100\%$$
  Customer identity is resolved by unique phone number (E.164 normalized), or buyer name if phone is missing.

---

## 2. Standardized Reference Test (The 3-Orders Scenario)

Given the following 3 orders placed in a single day:
1. **Order A**: Product A sold for **GH₵400**, status: `paid` (full payment). Product cost = **GH₵200**.
2. **Order B**: Product B sold for **GH₵500**, status: `deposit_paid` (deposit = **GH₵200**, balance = **GH₵300**). Product cost = **GH₵250**.
3. **Order C**: Product C sold for **GH₵300**, status: `pending` (unpaid). Product cost = **GH₵150**.
Operating Expenses recorded in period = **GH₵100**.

### Expected Verification Results:
| Metric | Calculation | Expected Value |
|---|---|---|
| **Total Orders** | 3 placed orders | **3** |
| **Order Value** | $400 + 500 + 300$ | **GH₵1,200.00** |
| **Revenue (Collected)** | $400 + 200$ | **GH₵600.00** |
| **Outstanding** | $300 (\text{Order B}) + 300 (\text{Order C})$ | **GH₵600.00** |
| **Average Order Value** | $\text{GH₵1,200} / 3$ | **GH₵400.00** |
| **Product Costs (COGS)**| $200 + 250$ | **GH₵450.00** |
| **Operating Expenses** | Recorded OpEx | **GH₵100.00** |
| **Net Profit** | $600 - 450 - 100$ | **GH₵50.00** |
| **Net Margin** | $50 / 600$ | **8.33%** |

---

## 3. Timezone & Bucketing Rules

1. **Seller Timezone**: All date boundaries (`from`, `to`), day bucketing, and x-axis labels must be evaluated in the seller's configured store timezone (`seller_settings.timezone`, default `"Africa/Accra"` or detected local timezone), **never raw UTC**.
2. **Zero-Filling**: Every calendar unit in the requested date range must exist in the time-series array. Days with zero sales must return `{ date, label, revenue: 0, orders: 0, expenses: 0, profit: 0 }` to avoid distorted bar charts with uneven spacing.
3. **CSV Export Formula Sanitization**: All exported CSV text cells starting with `=`, `+`, `-`, `@` must be prefixed with a single quote (`'`) to eliminate spreadsheet formula injection vulnerabilities.

---

## 4. Period Comparisons & Fair MTD Alignment

### 4.1 Fair Month-to-Date (MTD) Alignment
- **Problem**: When evaluating performance during an ongoing month (e.g. October 1–3), comparing month-to-date against the full prior month (September 1–30, 30 days) yields artificially negative comparisons and false "decline" warnings.
- **Rule**: If the active selection is a current month in progress, the comparison period is strictly clamped to the **exact same day-of-month window** in the previous month (e.g. September 1–3) and explicitly labeled in the UI as:
  $$\text{Label} = \text{"Same } N \text{ days last month (MTD)"}$$
- **Full Historical Months**: If the selected month is fully concluded (e.g. comparing August against July), the full month is compared against the full prior month ($M-1$).

### 4.2 Delta Percentage Calculation
- **General Formula**:
  $$\Delta \% = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100\%$$
- **Edge Case (Previous = 0)**:
  - If $\text{Previous} = 0$ and $\text{Current} > 0$, delta is undefined as a percentage. The system displays **"New"** with a neutral blue badge instead of $+100\%$ or $\infty$.
  - If $\text{Previous} = 0$ and $\text{Current} = 0$, delta is $0\%$ with a flat grey badge.
- **Lower-is-Better Inversion**:
  - For **Operating Expenses** and **Outstanding Balance**, an increase is unfavorable (red indicator) and a decrease is favorable (green indicator). The visual polarity is inverted in delta badges.

### 4.3 Sample-Size Guard Threshold
- To avoid generating statistically misleading conclusions from tiny numbers (e.g. 1 order vs 0 orders), all deterministic summary insights and gainer/decliner commentary require a minimum sample threshold of **$\ge 5$ placed orders** in both reporting periods.
- When below 5 orders, the UI renders:
  > *"Not enough data yet. Complete at least 5 orders in both periods to generate comparison trends."*

---

## 5. Report Insight Catalog Formulas & Aggregations

All 11 reports in the Analytics Hub read from canonical server-side aggregations:

### 5.1 Sales Summary (`sales-summary`) [Free]
- **Order Value vs Collected**: $\text{Order Value}$ vs $\text{Revenue Collected}$.
- **Average Order Value**: $\text{Order Value} / \text{Total Orders}$.
- **Revenue by Payment Status**: Segregated into `paid` (full cash), `deposit_paid` (partial collected + balance), and `pending` (uncollected).

### 5.2 Sales Over Time (`sales-over-time`) [Free]
- **Daily / Weekly / Monthly Series**: Chronological sequence with zero-filled days.
- **Revenue vs Orders**: Dual-axis bar and line distribution.
- **Best Day Identifier**: Single calendar date with peak revenue.

### 5.3 Product Performance (`product-performance`) [Pro]
- **Units Sold**: $\sum_{o \in \text{Orders}} o.\text{itemCount}$.
- **Product Revenue**: Total line item revenue generated per catalog item.
- **Inventory Value at Cost**: $\text{Stock on Hand} \times \text{Product Cost}$.
- **Zero-Sales Products**: Active catalog items with 0 sales within the selected timeframe.

### 5.4 Best Times to Sell (`best-times-to-sell`) [Pro]
- **Weekday Distribution**: Orders and revenue aggregated across Monday through Sunday.
- **Hourly Velocity**: Orders bucketed into 24 hour windows ($00:00$ through $23:00$) in store timezone.
- **Peak Window**: Identifies the 2-hour window generating highest transaction volume.

### 5.5 Sales by Channel (`sales-by-channel`) [Free]
- **Channel Categorization**: WhatsApp (`whatsapp`), Instagram (`instagram`), TikTok (`tiktok`), Facebook (`facebook`), Manual POS (`manual`), Web Store (`web`).
- **Channel Share**: $\frac{\text{Channel Revenue}}{\text{Total Revenue}} \times 100\%$.
- **Channel Growth**: Period-over-period delta per channel.

### 5.6 Orders Overview (`orders-overview`) [Free]
- **Fulfillment Pipeline**: Total count of orders by state (`pending`, `confirmed`, `delivered`, `cancelled`).
- **Fulfillment Rate**: $\frac{\text{Delivered Orders}}{\text{Total Placed Orders}} \times 100\%$.

### 5.7 Payments and Outstanding (`payments-and-outstanding`) [Pro]
- **Collection Rate**: $\frac{\text{Revenue Collected}}{\text{Order Value}} \times 100\%$.
- **Aging Buckets** (unpaid orders based on creation timestamp):
  - Under 7 days ($< 7\text{d}$)
  - 7 to 30 days ($7\text{d} - 30\text{d}$)
  - Over 30 days ($> 30\text{d}$)

### 5.8 Profit and Margin (`profit-and-margin`) [Pro]
- **Waterfall Breakdown**:
  $$\text{Gross Revenue} \longrightarrow \text{Gross Profit } (\text{Revenue} - \text{COGS}) \longrightarrow \text{Net Profit } (\text{Gross Profit} - \text{OpEx})$$
- **Net Margin**: $\frac{\text{Net Profit}}{\text{Revenue}} \times 100\%$.

### 5.9 Expenses (`expenses`) [Free]
- **Expense Categorization**: Inventory & packaging, Delivery & rider fees, Marketing & ads, Software & subscriptions, General operations.
- **Expense-to-Revenue Ratio**: $\frac{\text{Total OpEx}}{\text{Revenue}} \times 100\%$.

### 5.10 Customer Insights (`customer-insights`) [Pro]
- **Unique Buyers**: Distinct buyer phone numbers (or buyer names when phone absent).
- **New vs Repeat Buyers**: A buyer is "New" if their first recorded order occurred within this period; "Repeat" if they placed $\ge 1$ order prior to this period.
- **Repeat Purchase Rate**: $\frac{\text{Repeat Buyers}}{\text{Total Buyers}} \times 100\%$.
- **Top 10 Customers**: Ranked list by cumulative spend in period.

### 5.11 Inventory Health (`inventory-health`) [Free]
- **Total Products**: Count of active catalog items.
- **Total Units on Hand**: $\sum_{p \in \text{Products}} p.\text{stock}$.
- **Out of Stock**: Count of products with $\text{stock} \le 0$.
- **Low Stock**: Count of products with $0 < \text{stock} \le 3$ (or configured low-stock threshold).

---

## 6. Audit of Data Points Requiring New Schema ("Requires New Data")

To ensure analytical integrity, Take Order strictly utilizes verified database tables. The following requested concepts are **not** approximated or faked, and are marked as requiring future schema additions:

1. **Refunds & Return Reason Breakdowns**:
   - *Current State*: Orders support binary statuses (`cancelled` vs placed).
   - *Requirement*: An `order_refunds` table recording refund amounts, restocked inventory counts, and return reason categories (e.g. buyer changed mind, damaged item, incorrect sizing).
2. **Historical Batch Inventory Costs (FIFO/LIFO)**:
   - *Current State*: Product cost is a single snapshot property on `products.cost`.
   - *Requirement*: A `purchase_orders` or `inventory_lots` ledger recording unit cost at every restock batch to support dynamic FIFO/LIFO COGS calculations.
3. **Customer Acquisition Cost (CAC) per Channel**:
   - *Current State*: Organic order channels (WhatsApp, Instagram, etc.) are recorded.
   - *Requirement*: Integrations with ad platforms (Meta Ads API, Google Ads API, TikTok Ads API) to ingest marketing spend by channel.
4. **Granular Multi-Step Checkout Funnel Drop-Off**:
   - *Current State*: Total order link visits are counted via `orders.link_opens`.
   - *Requirement*: Client-side event logging for intermediate steps: Link Open $\to$ Item Selection $\to$ Address Entry $\to$ Payment Selection $\to$ Order Placed.
5. **Non-Order Web Browsing Sessions**:
   - *Current State*: Anonymous store visitor traffic is not logged in Postgres to prevent database bloat.
   - *Requirement*: Edge-aggregated web analytics logging session pageviews without mutating relational tables.

---

## 7. Plan Gating Defaults

| Report Slug | Title | Category | Minimum Plan | Rationale |
|---|---|---|---|---|
| `sales-summary` | Sales summary | Sales | Free | Essential core sales overview for every seller |
| `sales-over-time` | Sales over time | Sales | Free | Core volume trend over days/weeks |
| `product-performance` | Product performance | Sales | **Pro** | Deep item-level SKU profitability and velocity |
| `best-times-to-sell` | Best times to sell | Sales | **Pro** | Advanced 24h heatmap and sales scheduling |
| `sales-by-channel` | Sales by channel | Channels | Free | Channel attribution is core to social commerce |
| `orders-overview` | Orders overview | Orders | Free | Operational fulfillment and dispatch visibility |
| `payments-and-outstanding` | Payments and outstanding | Finance | **Pro** | Cash collection rate and aged debt tracking |
| `profit-and-margin` | Profit and margin | Finance | **Pro** | Full COGS + OpEx waterfall and net margin benchmarks |
| `expenses` | Expenses | Finance | Free | Basic operational expense tracking |
| `customer-insights` | Customer insights | Customers | **Pro** | Buyer repeat rates and customer LTV rankings |
| `inventory-health` | Inventory health | Inventory | Free | Core stockout prevention for all sellers |

