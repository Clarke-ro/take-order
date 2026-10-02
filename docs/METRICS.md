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
