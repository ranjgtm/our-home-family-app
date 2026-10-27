# 🌿 Our Home

**Our Home** is a mobile-first family household management application designed to make everyday coordination easier for a couple with a young child.

The application brings shared grocery planning, pantry management, meal planning, household expenses, calendar visibility and supermarket deals into one simple family-focused interface.

The project started from a real household problem: repeatedly asking each other what groceries were needed, whether the other person was free, what food was already at home, and how much the household was spending.

## ✨ Main Features

### 🛒 Shared Shopping List

Both adults can use the same household shopping list.

Features include:

- Add shopping items quickly
- See who added an item
- Mark products as purchased
- Frequently bought items
- Recently purchased items
- Duplicate-item protection
- Shared real-time household data
- Deal indicators when a matching supermarket offer is available

---

### 🏠 Pantry / At Home

Purchased food and household consumables can be moved into an **At Home** section.

Instead of complicated inventory tracking, items use simple statuses:

- Available
- Low
- Used Up

When something runs out, it can quickly be added back to the shopping list.

The pantry also includes **Kitchen Staples** for items such as:

- rice
- lentils
- flour
- spices
- turmeric
- cumin
- coriander
- mustard oil
- ginger
- garlic

This helps the meal planner understand what is already available in the kitchen.

---

### 🍛 Pantry-Aware Meal Planning

The meal planner generates meal suggestions using ingredients already available at home.

It considers:

- pantry ingredients
- kitchen staples
- recent purchases
- missing ingredients
- family size
- toddler-friendly adaptations
- cuisine preferences

The household has a preference for occasional **Nepali and South Asian meals**, while still maintaining variety.

Examples include:

- Dal bhat tarkari
- Nepali-style chicken curry
- Vegetable pulao
- Chana curry
- Khichdi
- Family-friendly pasta and international dishes

Missing ingredients can be added directly to the shared shopping list.

Accepted meals remain fixed until the family decides to replace them.

---

### 👶 Family & Toddler Context

The household consists of:

- two adult users
- one young child

The child does not require a separate login account.

Meal suggestions can include simple toddler adaptations such as:

- mild seasoning
- chilli added after removing the toddler portion
- smaller food pieces
- spicy sauces served separately

The goal is to plan one family meal rather than maintaining a completely separate toddler meal plan.

---

### 💶 Household Expense Tracking

The application tracks shared household spending in EUR (€).

Expense categories include:

- Groceries
- Household
- Home & Furniture
- Child
- Dining
- Transport
- Utilities
- Health / Pharmacy
- Clothing
- Personal Care
- Entertainment
- Other

The dashboard can show:

- monthly spending
- weekly spending
- category totals
- expenses paid by each adult
- previous-month history
- spending comparisons and insights

Users can manually correct expense categories, and merchant preferences can be remembered for future purchases.

---

### 🧾 Receipt Workflow

Receipt images can be attached to shopping trips or expenses.

The intended workflow is:

1. Upload or photograph a receipt
2. Extract merchant, total and purchased items
3. Review the detected information
4. Correct anything that was misread
5. Confirm the receipt
6. Create the expense
7. Update recently purchased items
8. Add suitable products to the household pantry

This makes it possible to capture items that were purchased even if they were not originally added to the shopping list.

---

### 📅 Shared Calendar View

Each adult connects their own Google Calendar.

**Our Home does not replace Google Calendar.**

Instead, it provides a read-only household view so both adults can understand each other's availability.

The application can show:

- both adults' events
- family events
- monthly calendar view
- free/busy information
- shared availability

Calendar events continue to be created and edited in Google Calendar itself.

---

### 🏷️ Grocery Deals

The Shopping section includes supermarket deals.

The application currently supports automatic import of public Lidl offers including:

- product image
- promotional price
- original price
- discount
- offer validity
- Lidl Plus requirement
- shopping-list matching

K-Market/K-Ruoka and Prisma/S-kaupat are prepared in the interface, but their websites restrict automated reading.

Rather than bypassing those restrictions, the application links users to the retailers' official offer pages and is designed to support official APIs or permitted data sources if they become available.

---

## 🎨 Design

The application uses a warm botanical family-oriented design instead of a typical financial or SaaS dashboard.

The design system uses:

- soft cream backgrounds
- muted lavender
- sage green
- warm apricot
- botanical accents
- family-friendly typography
- mobile-first cards and navigation

The interface is optimized primarily for iPhone use.

---

## 📱 Progressive Web App

Our Home is designed as a **Progressive Web App (PWA)**.

It can be added directly to an iPhone Home Screen and opened like an application without requiring the App Store.

---

## 🏗️ Architecture

The project uses a managed architecture to minimize long-term maintenance.

```text
Our Home
│
├── Mobile-first frontend
│
├── Lovable Cloud
│   ├── Authentication
│   ├── Household data
│   ├── Shopping
│   ├── Pantry
│   ├── Expenses
│   ├── Meal plans
│   └── File storage
│
├── Google Calendar
│   └── Read-only household calendar
│
└── External data
    ├── Lidl public offers
    └── Retailer links / future APIs
```

The architecture intentionally avoids running a custom server wherever managed services can provide the required functionality.

---

## 🔐 Privacy & Security

The application was designed around private household data.

Important considerations include:

- authenticated adult users
- household-level access
- private receipt storage
- no separate child login
- read-only calendar integration
- household data isolation
- no public exposure of personal expense information

The public portfolio version uses sample/demo data only.

---

## 🧠 Product Decisions

Several features were intentionally kept simple.

For example, the pantry does **not** attempt to track exact grams or millilitres of every ingredient.

Instead:

```text
Available → Low → Used Up
```

This reduces maintenance and makes the application practical for everyday family use.

Similarly, Google Calendar remains the source of truth for schedules rather than building another calendar system that users would need to maintain separately.

---

## 🧪 Development Approach

This project was developed through an **AI-assisted product development workflow using Lovable**.

My role included:

- identifying the household problem
- defining product requirements
- designing workflows
- designing the information architecture
- iterating on the mobile UX
- defining database requirements
- designing shared household logic
- testing real family usage
- identifying bugs from production usage
- defining privacy and security requirements
- integrating Google Calendar
- designing receipt workflows
- designing AI-assisted meal planning
- investigating supermarket data integrations
- improving the product through repeated user testing

The application evolved through real usage rather than being created as a static demonstration project.

---

## 💡 Examples of Problems Solved

### Duplicate shopping items

Both adults may add the same item independently.

The application detects possible duplicates rather than silently creating multiple copies.

### Expense categorisation

A completed shopping trip should not automatically mean **Groceries**.

For example:

```text
IKEA → Home & Furniture
Prisma → Groceries
Restaurant → Dining
```

Manual corrections take priority and can be remembered.

### Pantry accuracy

Shopping-list items alone do not represent everything available at home.

Kitchen staples and receipt purchases therefore contribute to meal planning.

### Retailer restrictions

Some supermarket websites prevent automated offer collection.

The application does not attempt to bypass those protections and instead supports official or permitted data sources.

---

## 🚀 Future Improvements

Possible future improvements include:

- improved receipt recognition
- personal grocery price history
- retailer API integrations
- household spending goals
- smarter pantry-to-recipe matching
- improved multilingual ingredient matching
- optional notifications
- expanded meal preference controls

---

## 📸 Screenshots

Screenshots of the mobile interface will be added using sample household information.

Suggested screenshots:

1. Home dashboard
2. Shared shopping list
3. Pantry / At Home
4. Meal planner
5. Expense dashboard
6. Shared calendar
7. Grocery deals

---

## 🛠️ Built With

- Lovable
- Lovable Cloud
- Google Calendar integration
- Progressive Web App technologies
- AI-assisted development workflow

---

## 👩‍💻 Author

**Ranjana Gautam**

GitHub: `@ranjgtm`

---

## 📌 Project Status

**Active personal portfolio project**

The application is being tested through real household usage and continuously improved based on practical feedback.
