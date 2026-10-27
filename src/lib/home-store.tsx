import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** A household adult's chosen display name. */
export type Person = string;

/** First letter of a name, for avatar bubbles. */
export const initials = (name: string) => (name.trim().charAt(0) || "?").toUpperCase();

export const CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Dairy",
  "Meat",
  "Pantry",
  "Household",
  "Personal Care",
  "Child / Toddler",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const FOOD_CATEGORIES: Category[] = [
  "Vegetables",
  "Fruits",
  "Dairy",
  "Meat",
  "Pantry",
  "Child / Toddler",
];

/** Placeholders in sample calendar data, swapped for the real adults at runtime. */
export const ADULT_A = "__adult_a";
export const ADULT_B = "__adult_b";

export type PantryStatus = "Available" | "Low" | "Used Up";
export type ShoppingStatus = "to_buy" | "in_basket" | "purchased";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string | undefined;
  unit?: string | undefined;
  category: Category;
  note?: string | undefined;
  addedBy: Person;
  frequent: boolean;
  status: ShoppingStatus;
  done: boolean; // in basket
  purchasedAt?: string | undefined;
};

export type PantryItem = { id: string; name: string; category: Category; status: PantryStatus; staple: boolean };

export type BoughtItem = { id: string; name: string; when: string; date: string; by: Person; store?: string | undefined; price: number | null };

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Household",
  "Home & Furniture",
  "Child",
  "Dining",
  "Transport",
  "Utilities",
  "Health / Pharmacy",
  "Clothing",
  "Personal Care",
  "Entertainment",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const asExpenseCategory = (c: string): ExpenseCategory =>
  (EXPENSE_CATEGORIES as readonly string[]).includes(c) ? (c as ExpenseCategory) : "Other";

/** Shopping-list category → expense category (null = not enough information). */
const SHOP_TO_EXPENSE: Record<Category, ExpenseCategory | null> = {
  Vegetables: "Groceries",
  Fruits: "Groceries",
  Dairy: "Groceries",
  Meat: "Groceries",
  Pantry: "Groceries",
  Household: "Household",
  "Personal Care": "Personal Care",
  "Child / Toddler": "Child",
  Other: null,
};

/** Normalised text for comparing names ("  Milk " == "milk"). */
export const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const DEFAULT_MERCHANTS: Record<string, ExpenseCategory> = {
  ikea: "Home & Furniture",
  prisma: "Groceries",
  "k-market": "Groceries",
  "k-supermarket": "Groceries",
  "k-citymarket": "Groceries",
  lidl: "Groceries",
  "s-market": "Groceries",
  alepa: "Groceries",
};

export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidBy: Person;
  date: string;
  fromShoppingTrip?: boolean;
  categoryManual?: boolean;
  store?: string | undefined;
  note?: string | undefined;
  receiptPath?: string | undefined;
};

export type Meal = {
  id: string;
  day: string;
  name: string;
  time: string;
  note: string;
  ingredients: string[];
  toddlerFriendly?: boolean;
  toddlerNote?: string | undefined;
};

export type PlannedMeal = {
  id: string;
  date: string;
  slot: "lunch" | "dinner";
  name: string;
  prepMinutes: number | null;
  atHome: string[];
  missing: string[];
  toddlerNote: string | null;
  toddlerFriendly: boolean;
  cuisine: string | null;
  staplesUsed: string[];
};

export type NewPlannedMeal = Omit<PlannedMeal, "id">;

export type CuisineFreq = "Often" | "Sometimes" | "Rarely";
export const CUISINES = ["Nepali", "Indian / South Asian", "European / Finnish", "International"] as const;
export const DEFAULT_CUISINE_PREFS: Record<string, CuisineFreq> = {
  Nepali: "Sometimes",
  "Indian / South Asian": "Sometimes",
  "European / Finnish": "Sometimes",
  International: "Sometimes",
};

export const STAPLE_GROUPS: { title: string; category: Category; items: string[] }[] = [
  { title: "Spices", category: "Pantry", items: ["Turmeric", "Cumin", "Coriander powder", "Chilli powder", "Garam masala", "Timur / Sichuan pepper", "Fenugreek", "Mustard seeds", "Ajwain", "Black pepper"] },
  { title: "Grains & pulses", category: "Pantry", items: ["Basmati rice", "Regular rice", "Atta / flour", "Red lentils", "Yellow lentils", "Chickpeas", "Kidney beans", "Black lentils", "Beaten rice / chiura"] },
  { title: "Cooking basics", category: "Pantry", items: ["Mustard oil", "Sunflower / vegetable oil", "Ghee", "Salt", "Sugar", "Ginger", "Garlic", "Onion", "Tomato paste"] },
];

export type CalendarEvent = {
  id: string;
  day: string;
  person: Person | "Family";
  withToddler?: boolean;
  title: string;
  start: number;
  end: number;
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const uid = () => Math.random().toString(36).slice(2, 10);

/** Local ISO date (YYYY-MM-DD). */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dates Mon..Sun of the current week. */
export function currentWeek(): string[] {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return DAYS.map((_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return isoDate(d);
  });
}

const initialMeals: Meal[] = [];
const initialEvents: CalendarEvent[] = [];

/** One reviewed purchased item. */
export type PurchaseLine = {
  key: string;
  name: string;
  /** Net line price in euros, when known. */
  price: number | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  atHome: boolean;
  pantryCategory: Category;
  shoppingItemId?: string | undefined;
};

export type NewPurchase = {
  /** Client-generated; the same id can never create a second expense. */
  tripId: string;
  store: string;
  date: string;
  total: number;
  paidBy: Person;
  category: ExpenseCategory;
  categoryManual: boolean;
  note?: string | undefined;
  receiptPath?: string | null | undefined;
  fromShoppingTrip: boolean;
  lines: PurchaseLine[];
};

/** Parses "12,40", "1 234,50" or "12.40" into a number (NaN if empty). */
export const parseEuro = (s: string) => {
  const t = s.replace(/[€\s]/g, "");
  if (!t) return Number.NaN;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return Number.parseFloat(norm);
};

const NOT_AT_HOME = /\b(rug|carpet|mat|chair|table|sofa|shelf|lamp|plate|bowl|cup|mug|glass(es)?|pan|pot|knife|fork|spoon|towel|curtain|pillow|cushion|blanket|frame|vase|shirt|t-shirt|trousers|jeans|dress|sock|shoe|jacket|coat|toy|book|cable|charger|tool|box|basket|hanger|bag|furniture|decoration|deposit)s?\b/i;
/** Consumables belong At Home; durable objects don't. */
export const guessAtHome = (name: string) => !NOT_AT_HOME.test(name);

/** Resize big phone photos so uploads are quick and never exceed the size limit. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export type NewShoppingItem = {
  name: string;
  quantity?: string | undefined;
  unit?: string | undefined;
  category?: Category | undefined;
  note?: string | undefined;
  addedBy?: Person | undefined;
};


type Membership = { householdId: string; person: Person };
type HouseholdInfo = { name: string; inviteCode: string; members: Person[]; childName: string };

/** Which colour identity a name carries: first adult, second adult, or the family. */
export type PersonTone = "brand" | "accent" | "herb";

type Store = {
  authReady: boolean;
  session: Session | null;
  membership: Membership | null;
  membershipReady: boolean;
  household: HouseholdInfo | null;
  me: Person;
  adults: Person[];
  partner: Person | null;
  toneOf: (p: Person) => PersonTone;
  renameMe: (name: string) => Promise<string | null>;
  refreshMembership: () => Promise<void>;
  signOut: () => Promise<void>;
  shopping: ShoppingItem[];
  pantry: PantryItem[];
  bought: BoughtItem[];
  expenses: Expense[];
  meals: Meal[];
  planned: PlannedMeal[];
  keepMeal: (m: NewPlannedMeal) => Promise<void>;
  removePlanned: (id: string) => Promise<void>;
  events: CalendarEvent[];
  frequent: string[];
  toggleFrequent: (name: string) => void;
  addUsualItems: () => Promise<number>;
  /** Returns the existing active item with the same normalised name, if any. */
  findDuplicate: (name: string) => ShoppingItem | undefined;
  /** force = intentionally add another even if the name is already on the list. */
  addShoppingItem: (item: NewShoppingItem, force?: boolean) => Promise<void>;
  toggleShoppingItem: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  moveToPantry: (id: string) => void;
  setPantryStatus: (id: string, status: PantryStatus) => void;
  deletePantryItem: (id: string) => void;
  pantryToShopping: (id: string, by: Person) => void;
  addMissingToShopping: (names: string[], by: Person) => void;
  /** Remembered or default category for a shop, or null. */
  merchantCategory: (store: string) => ExpenseCategory | null;
  /** Expense categories implied by what's in the basket. */
  basketCategories: () => ExpenseCategory[];
  /** Upload a receipt photo to the household's private folder; returns its storage path. */
  uploadReceipt: (file: File) => Promise<string>;
  /** Short-lived private link to view a receipt. */
  receiptUrl: (path: string) => Promise<string | null>;
  /** Best To Buy / basket item matching a purchased item's name. */
  matchShoppingItem: (name: string) => ShoppingItem | undefined;
  /** One expense + its purchased items + list/At Home updates. Safe to retry (same tripId). */
  savePurchase: (p: NewPurchase) => Promise<void>;
  /** Put items straight into the basket (picked up in store, never on the list). */
  addToBasket: (names: string[], by: Person, category?: Category) => Promise<void>;
  deletePurchased: (id: string) => Promise<void>;
  updatePurchased: (id: string, name: string, price: number | null) => Promise<void>;
  renamePantryItem: (id: string, name: string) => Promise<void>;
  cuisinePrefs: Record<string, CuisineFreq>;
  setCuisinePref: (cuisine: string, freq: CuisineFreq) => Promise<void>;
  /** Tap a staple: mark Available (adding it if new), or tap again to unmark. */
  toggleStaple: (name: string, category: Category) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setExpenseCategory: (id: string, category: ExpenseCategory) => Promise<void>;
};

// Keep one context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __homeCtx?: React.Context<Store | null> };
const HomeContext = (g.__homeCtx ??= createContext<Store | null>(null));

function relative(ts?: string | null) {
  if (!ts) return "Recently";
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const asCategory = (c: string): Category => ((CATEGORIES as readonly string[]).includes(c) ? (c as Category) : "Other");
const asPerson = (p: string): Person => (p ?? "").trim() || "Someone";
const logErr = (error: unknown) => {
  if (error) console.error(error);
};

export function HomeProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [membershipReady, setMembershipReady] = useState(false);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);

  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals] = useState<Meal[]>(initialMeals);
  const [planned, setPlanned] = useState<PlannedMeal[]>([]);
  const [cuisinePrefs, setCuisinePrefs] = useState<Record<string, CuisineFreq>>(DEFAULT_CUISINE_PREFS);
  const [events] = useState<CalendarEvent[]>(initialEvents);

  // Auth session (persisted on device until explicit sign-out)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refreshMembership = useCallback(async () => {
    if (!userId) {
      setMembership(null);
      setHousehold(null);
      setMembershipReady(true);
      return;
    }
    const { data } = await supabase
      .from("household_members")
      .select("household_id, person")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) {
      setMembership(null);
      setHousehold(null);
    } else {
      setMembership({ householdId: data.household_id, person: asPerson(data.person) });
      const [{ data: h }, { data: members }, { data: child }] = await Promise.all([
        supabase.from("households").select("name, invite_code, cuisine_prefs").eq("id", data.household_id).maybeSingle(),
        supabase.from("household_members").select("person").eq("household_id", data.household_id).order("created_at", { ascending: true }),
        supabase.from("child_profiles").select("name").eq("household_id", data.household_id).limit(1).maybeSingle(),
      ]);
      setCuisinePrefs({ ...DEFAULT_CUISINE_PREFS, ...((h?.cuisine_prefs as Record<string, CuisineFreq> | null) ?? {}) });
      setHousehold({
        name: h?.name ?? "Our Home",
        inviteCode: h?.invite_code ?? "",
        members: (members ?? []).map((m) => asPerson(m.person)),
        childName: child?.name ?? "Little one",
      });
    }
    setMembershipReady(true);
  }, [userId]);

  useEffect(() => {
    if (!authReady) return;
    setMembershipReady(false);
    void refreshMembership();
  }, [authReady, refreshMembership]);

  const hid = membership?.householdId ?? null;

  const loadShopping = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", hid)
      .order("created_at", { ascending: false });
    logErr(error);
    setShopping(
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        quantity: r.quantity ?? undefined,
        unit: r.unit ?? undefined,
        category: asCategory(r.category),
        note: r.note ?? undefined,
        addedBy: asPerson(r.added_by_name),
        frequent: r.frequent,
        status: r.status as ShoppingStatus,
        done: r.status === "in_basket",
        purchasedAt: r.purchased_at ?? undefined,
      })),
    );
  }, [hid]);

  const loadPantry = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase
      .from("pantry_items")
      .select("*")
      .eq("household_id", hid)
      .order("created_at", { ascending: false });
    logErr(error);
    setPantry((data ?? []).map((r) => ({ id: r.id, name: r.name, category: asCategory(r.category), status: r.status as PantryStatus, staple: !!r.is_staple })));
  }, [hid]);

  const loadExpenses = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("household_id", hid)
      .order("spent_on", { ascending: false });
    logErr(error);
    setExpenses(
      (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        category: asExpenseCategory(r.category),
        amount: Number(r.amount),
        paidBy: asPerson(r.paid_by),
        date: r.spent_on,
        fromShoppingTrip: r.from_shopping_trip,
        categoryManual: r.category_manual,
        store: r.store ?? undefined,
        note: r.note ?? undefined,
        receiptPath: r.receipt_path ?? undefined,
      })),
    );
  }, [hid]);

  const [merchants, setMerchants] = useState<Record<string, ExpenseCategory>>({});
  const loadMerchants = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase.from("merchant_categories").select("merchant_key, category").eq("household_id", hid);
    logErr(error);
    setMerchants(Object.fromEntries((data ?? []).map((r) => [r.merchant_key, asExpenseCategory(r.category)])));
  }, [hid]);

  const [purchased, setPurchased] = useState<{ id: string; name: string; date: string; by: Person; store?: string | undefined; price: number | null }[]>([]);
  const loadPurchased = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase
      .from("purchased_items")
      .select("id, name, purchased_on, bought_by, store, line_total, created_at")
      .eq("household_id", hid)
      .order("purchased_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    logErr(error);
    setPurchased(
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        date: r.purchased_on,
        by: asPerson(r.bought_by),
        store: r.store ?? undefined,
        price: r.line_total == null ? null : Number(r.line_total),
      })),
    );
  }, [hid]);

  const loadPlanned = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase
      .from("planned_meals")
      .select("*")
      .eq("household_id", hid)
      .gte("plan_date", isoDate(new Date(Date.now() - 86400000)))
      .order("plan_date", { ascending: true });
    logErr(error);
    setPlanned(
      (data ?? []).map((r) => ({
        id: r.id,
        date: r.plan_date,
        slot: r.slot === "lunch" ? "lunch" : "dinner",
        name: r.name,
        prepMinutes: r.prep_minutes,
        atHome: r.at_home,
        missing: r.missing,
        toddlerNote: r.toddler_note,
        toddlerFriendly: r.toddler_friendly,
        cuisine: r.cuisine ?? null,
        staplesUsed: r.staples_used ?? [],
      })),
    );
  }, [hid]);

  // Initial load + realtime sync between both adults
  useEffect(() => {
    if (!hid) {
      setShopping([]);
      setPantry([]);
      setExpenses([]);
      return;
    }
    void loadShopping();
    void loadPantry();
    void loadExpenses();
    void loadPlanned();
    void loadMerchants();
    void loadPurchased();
    const channel = supabase
      .channel(`household-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${hid}` }, () => void loadShopping())
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_items", filter: `household_id=eq.${hid}` }, () => void loadPantry())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${hid}` }, () => void loadExpenses())
      .on("postgres_changes", { event: "*", schema: "public", table: "planned_meals", filter: `household_id=eq.${hid}` }, () => void loadPlanned())
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_categories", filter: `household_id=eq.${hid}` }, () => void loadMerchants())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchased_items", filter: `household_id=eq.${hid}` }, () => void loadPurchased())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hid, loadShopping, loadPantry, loadExpenses, loadPlanned, loadMerchants, loadPurchased]);

  const me: Person = membership?.person ?? "";
  const adults: Person[] = useMemo(() => household?.members ?? (me ? [me] : []), [household, me]);
  const partner = adults.find((a) => a !== me) ?? null;

  const toneOf = useCallback(
    (p: Person): PersonTone => (p === "Family" ? "herb" : adults[1] && p === adults[1] ? "accent" : "brand"),
    [adults],
  );

  // Sample calendar data carries placeholders; show the real names.
  const shownEvents = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        person: e.person === ADULT_A ? (adults[0] ?? "Adult 1") : e.person === ADULT_B ? (adults[1] ?? "Adult 2") : e.person,
      })),
    [events, adults],
  );

  const renameMe = useCallback(
    async (name: string): Promise<string | null> => {
      const nm = name.trim();
      if (!nm) return "Please enter a name.";
      if (!membership) return "You are not in a home yet.";
      const { error } = await supabase.from("household_members").update({ person: nm }).eq("household_id", membership.householdId).eq("person", membership.person);
      if (error) return error.message.includes("duplicate") ? "That name is already used in your home." : error.message;
      await supabase.from("expenses").update({ paid_by: nm }).eq("household_id", membership.householdId).eq("paid_by", membership.person);
      await supabase.from("shopping_items").update({ added_by_name: nm }).eq("household_id", membership.householdId).eq("added_by_name", membership.person);
      await refreshMembership();
      return null;
    },
    [membership, refreshMembership],
  );

  const value = useMemo<Store>(() => {
    const active = shopping.filter((i) => i.status !== "purchased");

    /** Adds items to To Buy, skipping names already active; revives purchased rows instead of duplicating. */
    const addToShopping = async (items: NewShoppingItem[], force = false) => {
      if (!hid) return 0;
      const activeNames = new Set(force ? [] : active.map((i) => normName(i.name)));
      let added = 0;
      for (const it of items) {
        const name = it.name.trim();
        if (!name || activeNames.has(normName(name))) continue;
        activeNames.add(normName(name));
        const old = shopping.find((s) => s.status === "purchased" && normName(s.name) === normName(name));
        if (old) {
          const { error } = await supabase
            .from("shopping_items")
            .update({
              status: "to_buy",
              purchased_at: null,
              added_by_name: it.addedBy ?? me,
              quantity: it.quantity ?? old.quantity ?? null,
              note: it.note ?? null,
            })
            .eq("id", old.id);
          logErr(error);
        } else {
          const { error } = await supabase.from("shopping_items").insert({
            household_id: hid,
            name,
            quantity: it.quantity ?? null,
            unit: it.unit ?? null,
            category: it.category ?? "Other",
            note: it.note ?? null,
            added_by_name: it.addedBy ?? me,
          });
          logErr(error);
        }
        added++;
      }
      await loadShopping();
      return added;
    };

    const upsertPantry = async (items: { name: string; category: Category }[]) => {
      if (!hid || !items.length) return;
      for (const i of items) {
        const hit = pantry.find((p) => normName(p.name) === normName(i.name));
        if (hit) {
          logErr((await supabase.from("pantry_items").update({ status: "Available" }).eq("id", hit.id)).error);
        } else {
          logErr((await supabase.from("pantry_items").insert({ household_id: hid, name: i.name, category: i.category })).error);
        }
      }
      await loadPantry();
    };

    const merchantCategory = (store: string): ExpenseCategory | null => {
      const k = normName(store);
      if (!k) return null;
      return merchants[k] ?? DEFAULT_MERCHANTS[k] ?? null;
    };
    const rememberMerchant = async (store: string, category: ExpenseCategory) => {
      const k = normName(store);
      if (!hid || !k || merchants[k] === category) return;
      setMerchants((m) => ({ ...m, [k]: category }));
      logErr(
        (await supabase.from("merchant_categories").upsert({ household_id: hid, merchant_key: k, category }, { onConflict: "household_id,merchant_key" })).error,
      );
    };

    const frequent = Array.from(
      new Map(shopping.filter((i) => i.frequent).map((i) => [i.name.toLowerCase(), i.name])).values(),
    );

    const bought: BoughtItem[] = purchased.map((p) => ({
      id: p.id,
      name: p.name,
      when: relative(p.date),
      date: p.date,
      by: p.by,
      store: p.store,
      price: p.price,
    }));

    return {
      authReady,
      session,
      membership,
      membershipReady,
      household,
      me,
      adults,
      partner,
      toneOf,
      renameMe,
      refreshMembership,
      signOut: async () => {
        await supabase.auth.signOut();
        setMembership(null);
        setHousehold(null);
      },
      shopping: active,
      pantry,
      bought,
      expenses,
      meals,
      planned,
      keepMeal: async (m) => {
        if (!hid) return;
        const { error } = await supabase.from("planned_meals").upsert(
          {
            household_id: hid,
            plan_date: m.date,
            slot: m.slot,
            name: m.name,
            prep_minutes: m.prepMinutes,
            at_home: m.atHome,
            missing: m.missing,
            toddler_note: m.toddlerNote,
            toddler_friendly: m.toddlerFriendly,
            cuisine: m.cuisine,
            staples_used: m.staplesUsed,
          },
          { onConflict: "household_id,plan_date,slot" },
        );
        if (error) throw new Error("Could not save this meal");
        await loadPlanned();
      },
      removePlanned: async (id) => {
        logErr((await supabase.from("planned_meals").delete().eq("id", id)).error);
        await loadPlanned();
      },
      events: shownEvents,
      frequent,
      toggleFrequent: (name) => {
        if (!hid) return;
        const next = !frequent.some((f) => f.toLowerCase() === name.toLowerCase());
        void supabase
          .from("shopping_items")
          .update({ frequent: next })
          .eq("household_id", hid)
          .ilike("name", name)
          .then(({ error }) => {
            logErr(error);
            void loadShopping();
          });
      },
      addUsualItems: () => addToShopping(frequent.map((name) => ({ name, category: shopping.find((s) => s.name === name)?.category }))),
      findDuplicate: (name) => active.find((i) => normName(i.name) === normName(name)),
      addShoppingItem: async (item, force) => {
        await addToShopping([item], force);
      },
      deletePantryItem: (id) => {
        setPantry((prev) => prev.filter((p) => p.id !== id));
        void supabase.from("pantry_items").delete().eq("id", id).then(({ error }) => logErr(error));
      },
      merchantCategory,
      basketCategories: () => {
        const cats = shopping.filter((i) => i.status === "in_basket").map((i) => SHOP_TO_EXPENSE[i.category]);
        if (cats.some((c) => c === null)) return [];
        return Array.from(new Set(cats as ExpenseCategory[]));
      },
      deleteExpense: async (id) => {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        const { error } = await supabase.from("expenses").delete().eq("id", id);
        if (error) {
          await loadExpenses();
          throw new Error("Could not delete this expense");
        }
      },
      setExpenseCategory: async (id, category) => {
        const e = expenses.find((x) => x.id === id);
        setExpenses((prev) => prev.map((x) => (x.id === id ? { ...x, category, categoryManual: true } : x)));
        const { data, error } = await supabase.from("expenses").update({ category, category_manual: true }).eq("id", id).select("id");
        if (error || !data?.length) {
          console.error(error);
          await loadExpenses();
          throw new Error("Couldn't change the category. Please try again.");
        }
        if (e?.store) await rememberMerchant(e.store, category);
      },
      toggleShoppingItem: (id) => {
        const item = shopping.find((i) => i.id === id);
        if (!item) return;
        setShopping((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done, status: i.done ? "to_buy" : "in_basket" } : i)));
        void supabase
          .from("shopping_items")
          .update({ status: item.done ? "to_buy" : "in_basket" })
          .eq("id", id)
          .then(({ error }) => logErr(error));
      },
      removeShoppingItem: (id) => {
        setShopping((prev) => prev.filter((i) => i.id !== id));
        void supabase.from("shopping_items").delete().eq("id", id).then(({ error }) => logErr(error));
      },
      moveToPantry: (id) => {
        const item = shopping.find((i) => i.id === id);
        if (!item) return;
        void (async () => {
          logErr((await supabase.from("shopping_items").update({ status: "purchased", purchased_at: new Date().toISOString() }).eq("id", id)).error);
          logErr(
            (
              await supabase
                .from("purchased_items")
                .insert({ household_id: hid!, shopping_item_id: item.id, name: item.name, purchased_on: isoDate(new Date()), bought_by: me || item.addedBy })
            ).error,
          );
          await upsertPantry([{ name: item.name, category: item.category }]);
          await loadPurchased();
          await loadShopping();
        })();
      },
      setPantryStatus: (id, status) => {
        setPantry((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
        void supabase.from("pantry_items").update({ status }).eq("id", id).then(({ error }) => logErr(error));
      },
      pantryToShopping: (id, by) => {
        const item = pantry.find((p) => p.id === id);
        if (!item) return;
        void addToShopping([{ name: item.name, category: item.category, addedBy: by }]);
      },
      addMissingToShopping: (names, by) =>
        void addToShopping(
          names.map((name) => ({
            name,
            category: pantry.find((p) => p.name === name)?.category ?? "Other",
            addedBy: by,
            note: "For a planned meal",
          })),
        ),
      addToBasket: async (names, by, category = "Other") => {
        if (!hid) return;
        for (const raw of names) {
          const name = raw.trim();
          if (!name) continue;
          const existing = active.find((i) => normName(i.name) === normName(name));
          if (existing) {
            logErr((await supabase.from("shopping_items").update({ status: "in_basket" }).eq("id", existing.id)).error);
          } else {
            logErr(
              (
                await supabase
                  .from("shopping_items")
                  .insert({ household_id: hid, name, category, added_by_name: by, status: "in_basket" })
              ).error,
            );
          }
        }
        await loadShopping();
      },
      uploadReceipt: async (file) => {
        if (!hid) throw new Error("Your home isn't loaded yet — please wait a moment.");
        const blob = await shrinkImage(file);
        const path = `${hid}/${Date.now()}-${uid()}.jpg`;
        const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (error) {
          console.error(error);
          throw new Error("The receipt photo couldn't be uploaded.");
        }
        return path;
      },
      receiptUrl: async (path) => {
        // Private bucket: a short-lived link, only issued to members of this household.
        const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
        logErr(error);
        return data?.signedUrl ?? null;
      },
      matchShoppingItem: (name) => {
        const n = normName(name);
        if (!n) return undefined;
        return (
          active.find((i) => normName(i.name) === n) ??
          active.find((i) => {
            const m = normName(i.name);
            return m.length >= 3 && n.length >= 3 && (n.includes(m) || m.includes(n));
          })
        );
      },
      savePurchase: async (p) => {
        if (!hid) throw new Error("Your home isn't loaded yet — please wait a moment and try again.");
        if (!Number.isFinite(p.total) || p.total <= 0) throw new Error("Please enter the amount paid.");
        const store = p.store.trim();
        const { data: row, error } = await supabase
          .from("expenses")
          .insert({
            household_id: hid,
            trip_id: p.tripId,
            title: store || (p.fromShoppingTrip ? "Shopping trip" : p.category),
            category: p.category,
            category_manual: p.categoryManual,
            amount: Math.round(p.total * 100) / 100,
            paid_by: p.paidBy,
            spent_on: p.date,
            store: store || null,
            note: p.note?.trim() || null,
            from_shopping_trip: p.fromShoppingTrip,
            receipt_path: p.receiptPath ?? null,
          })
          .select("id")
          .single();
        // 23505 = this exact save already went through (double tap / retry) — never create a second copy.
        if (error?.code === "23505") {
          await Promise.all([loadExpenses(), loadShopping(), loadPurchased(), loadPantry()]);
          return;
        }
        if (error || !row) {
          console.error(error);
          throw new Error(error?.message ? `Couldn't save: ${error.message}` : "Couldn't save this expense.");
        }
        if (store && p.categoryManual) await rememberMerchant(store, p.category);

        // One Bought Recently row per distinct item.
        const seen = new Set<string>();
        const lines = p.lines.filter((l) => {
          const k = normName(l.name);
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (lines.length) {
          logErr(
            (
              await supabase.from("purchased_items").insert(
                lines.map((l) => ({
                  household_id: hid,
                  expense_id: row.id,
                  shopping_item_id: l.shoppingItemId ?? null,
                  name: l.name.trim().slice(0, 80),
                  quantity: l.quantity,
                  unit: l.unit,
                  unit_price: l.unitPrice,
                  line_total: l.price,
                  store: store || null,
                  purchased_on: p.date,
                  bought_by: p.paidBy,
                })),
              )
            ).error,
          );
        }
        const listIds = [...new Set(lines.map((l) => l.shoppingItemId).filter((x): x is string => !!x))];
        if (listIds.length) {
          logErr(
            (await supabase.from("shopping_items").update({ status: "purchased", purchased_at: new Date().toISOString() }).in("id", listIds)).error,
          );
        }
        await upsertPantry(lines.filter((l) => l.atHome).map((l) => ({ name: l.name.trim().slice(0, 80), category: l.pantryCategory })));
        await Promise.all([loadShopping(), loadExpenses(), loadPurchased()]);
      },
      deletePurchased: async (id) => {
        setPurchased((prev) => prev.filter((x) => x.id !== id));
        const { error } = await supabase.from("purchased_items").delete().eq("id", id);
        if (error) {
          await loadPurchased();
          throw new Error("Couldn't delete this item");
        }
      },
      updatePurchased: async (id, name, price) => {
        const nm = name.trim();
        if (!nm) return;
        const { error } = await supabase.from("purchased_items").update({ name: nm.slice(0, 80), line_total: price }).eq("id", id);
        if (error) throw new Error("Couldn't update this item");
        await loadPurchased();
      },
      renamePantryItem: async (id, name) => {
        const nm = name.trim();
        if (!nm) return;
        const { error } = await supabase.from("pantry_items").update({ name: nm.slice(0, 80) }).eq("id", id);
        if (error) throw new Error("Couldn't rename this item");
        await loadPantry();
      },
      cuisinePrefs,
      setCuisinePref: async (cuisine, freq) => {
        if (!hid) return;
        const next = { ...cuisinePrefs, [cuisine]: freq };
        setCuisinePrefs(next);
        const { error } = await supabase.from("households").update({ cuisine_prefs: next }).eq("id", hid);
        if (error) {
          console.error(error);
          throw new Error("Couldn't save this preference");
        }
      },
      toggleStaple: async (name, category) => {
        if (!hid) return;
        const hit = pantry.find((p) => normName(p.name) === normName(name));
        if (hit) {
          const on = !(hit.staple && hit.status === "Available");
          const patch = on ? { is_staple: true, status: "Available" } : { is_staple: false };
          setPantry((prev) => prev.map((p) => (p.id === hit.id ? { ...p, staple: on, status: on ? "Available" : p.status } : p)));
          logErr((await supabase.from("pantry_items").update(patch).eq("id", hit.id)).error);
        } else {
          logErr((await supabase.from("pantry_items").insert({ household_id: hid, name: name.trim().slice(0, 80), category, is_staple: true })).error);
        }
        await loadPantry();
      },
    };
  }, [authReady, session, membership, membershipReady, household, me, adults, partner, toneOf, renameMe, refreshMembership, shopping, pantry, expenses, meals, planned, loadPlanned, shownEvents, hid, loadShopping, loadPantry, loadExpenses, loadPurchased, purchased, merchants, cuisinePrefs]);

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export function useHome() {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHome must be used inside HomeProvider");
  return ctx;
}

export const euro = (n: number) =>
  new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(n);
