import type {
  Category,
  DB,
  Product,
  RestaurantSettings,
  RestaurantTable,
  Staff,
} from "./types";
import { permissionsForRole } from "./permissions";
import { randomToken, uid } from "./utils";
import { hashPassword } from "./hash";

// The previous keyword-image service (loremflickr.com) now answers 401 for
// every request, which broke ALL food photos. We intentionally ship without an
// external image host: <FoodImage> renders the on-brand gradient + emoji
// fallback instantly (no broken requests, no flash), and the client can set
// real photos per product from the admin panel.
function foodImg(_keyword: string, _lock: number): string {
  return "";
}

const CATEGORY_DEFS: { slug: string; uz: string; ru: string; en: string; icon: string; img: string }[] = [
  { slug: "poke", uz: "Poke", ru: "Поке", en: "Poke", icon: "🥗", img: "poke,bowl" },
  { slug: "rolls", uz: "Rolls", ru: "Роллы", en: "Rolls", icon: "🍥", img: "sushi,rolls" },
  { slug: "sushi", uz: "Sushi", ru: "Суши", en: "Sushi", icon: "🍣", img: "sushi" },
  { slug: "bar", uz: "Bar", ru: "Бар", en: "Bar", icon: "🍹", img: "cocktail,drink" },
  { slug: "bread", uz: "Xleb va garnirlar", ru: "Хлеб и гарниры", en: "Bread & Sides", icon: "🍞", img: "bread,side" },
  { slug: "drinks", uz: "Napитki", ru: "Напитки", en: "Drinks", icon: "🥤", img: "soda,drink" },
  { slug: "sets", uz: "Setlar", ru: "Сеты", en: "Sets", icon: "🍱", img: "sushi,set" },
  { slug: "promo", uz: "Aksiyalar", ru: "Акции", en: "Promotions", icon: "🔥", img: "sushi,platter" },
  { slug: "dessert", uz: "Dessert", ru: "Десерты", en: "Desserts", icon: "🍰", img: "dessert,cake" },
  { slug: "salads", uz: "Salatlar", ru: "Салаты", en: "Salads", icon: "🥬", img: "salad,healthy" },
  { slug: "baked", uz: "Zapechyonniy rollar", ru: "Запечённые роллы", en: "Baked Rolls", icon: "🔥", img: "baked,sushi,roll" },
  { slug: "baked-sushi", uz: "Zapechyonniy sushi", ru: "Запечённые суши", en: "Baked Sushi", icon: "🍤", img: "baked,sushi" },
  { slug: "maki", uz: "Maki", ru: "Маки", en: "Maki", icon: "🍙", img: "maki,roll" },
];

type P = {
  cat: string;
  uz: string;
  ru: string;
  en: string;
  price: number;
  old?: number;
  cal: number;
  weight: number;
  ing: string;
  allerg: string;
  img: string;
  popular?: boolean;
  isNew?: boolean;
  promo?: boolean;
  desc?: string;
  rating?: number;
  ratingCount?: number;
};

const PRODUCTS: P[] = [
  // ---------------- POKE ----------------
  { cat: "poke", uz: "Tunts bilan poke", ru: "Поке с тунцом", en: "Tuna Poke", price: 95000, old: 110000, cal: 320, weight: 320, ing: "Tuna, guruch, avokado, edamame, Noriz sous", allerg: "Baliq, soya", img: "poke,tuna", popular: true, promo: true, rating: 4.8, ratingCount: 124, desc: "Yangi tunes baliqlari, guruch va avokado bilan." },
  { cat: "poke", uz: "Losos bilan poke", ru: "Поке с лососем", en: "Salmon Poke", price: 110000, cal: 340, weight: 330, ing: "Losos, guruch, bodring, kunjut", allerg: "Baliq, soya", img: "poke,salmon", popular: true, rating: 4.7, ratingCount: 98 },
  { cat: "poke", uz: "Krevetka bilan poke", ru: "Поке с креветками", en: "Shrimp Poke", price: 85000, cal: 300, weight: 310, ing: "Krevetka, guruch, mango, edamame", allerg: "Qisqichbaqa, soya", img: "poke,shrimp", isNew: true, rating: 4.6, ratingCount: 61 },
  { cat: "poke", uz: "Tovuqli poke", ru: "Поке с курицей", en: "Chicken Poke", price: 78000, cal: 380, weight: 320, ing: "Tovuq, guruch, sabzavotlar", allerg: "Soya", img: "poke,chicken", rating: 4.5, ratingCount: 44 },
  { cat: "poke", uz: "Vegetarian poke", ru: "Поке вегетарианский", en: "Veggie Poke", price: 68000, cal: 260, weight: 300, ing: "Avokado, tofu, guruch, sabzavotlar", allerg: "Soya", img: "poke,vegetable", rating: 4.4, ratingCount: 30 },

  // ---------------- ROLLS ----------------
  { cat: "rolls", uz: "Kaliforniya", ru: "Калифорния", en: "California Roll", price: 55000, cal: 250, weight: 220, ing: "Losos, avokado, krem-sir, guruch, nori", allerg: "Baliq, sut, soya", img: "california,roll", popular: true, rating: 4.9, ratingCount: 210 },
  { cat: "rolls", uz: "Filadelfiya losos bilan", ru: "Филадельфия с лососем", en: "Philadelphia Salmon", price: 100000, old: 120000, cal: 320, weight: 250, ing: "Losos, krem-sir, bodring, guruch, nori", allerg: "Baliq, sut, soya", img: "philadelphia,roll", popular: true, promo: true, rating: 4.8, ratingCount: 124, desc: "Klassik Filadelfiya rolli: yangi losos, krem-sir, bodring va guruchdan tayyorlanadi." },
  { cat: "rolls", uz: "Zapechyonniy ostriy roll", ru: "Запечённый острый ролл", en: "Baked Spicy Roll", price: 55000, cal: 380, weight: 240, ing: "Losos, sir, achchiq sous", allerg: "Baliq, sut", img: "baked,roll", rating: 4.6, ratingCount: 77 },
  { cat: "rolls", uz: "Filadelfiya krevetka bilan", ru: "Филадельфия с креветками", en: "Philadelphia Shrimp", price: 105000, cal: 300, weight: 250, ing: "Krevetka, krem-sir, avokado", allerg: "Qisqichbaqa, sut", img: "shrimp,roll", popular: true, rating: 4.7, ratingCount: 88 },
  { cat: "rolls", uz: "Yumi tunts bilan", ru: "Юми с тунцом", en: "Yumi Tuna Roll", price: 95000, cal: 310, weight: 245, ing: "Tuna, avokado, krem-sir, kunjut", allerg: "Baliq, sut", img: "tuna,roll", rating: 4.7, ratingCount: 65 },
  { cat: "rolls", uz: "Kyudai", ru: "Кюдай", en: "Kyudai", price: 105000, cal: 360, weight: 260, ing: "Losos, tunts, avokado, sir", allerg: "Baliq, sut", img: "sushi,roll", isNew: true, rating: 4.8, ratingCount: 52 },
  { cat: "rolls", uz: "Dragon roll", ru: "Дракон ролл", en: "Dragon Roll", price: 115000, cal: 400, weight: 270, ing: "Unagi, avokado, krem-sir", allerg: "Baliq, sut", img: "dragon,roll", rating: 4.9, ratingCount: 71 },
  { cat: "rolls", uz: "Achchiq tunts roll", ru: "Острый ролл с тунцом", en: "Spicy Tuna Roll", price: 90000, cal: 330, weight: 235, ing: "Tuna, achchiq sous, bodring", allerg: "Baliq", img: "spicy,tuna,roll", rating: 4.5, ratingCount: 47 },
  { cat: "rolls", uz: "Vegetarian roll", ru: "Вегетарианский ролл", en: "Veggie Roll", price: 48000, cal: 210, weight: 210, ing: "Avokado, bodring, marul", allerg: "Soya", img: "vegetable,roll", rating: 4.3, ratingCount: 26 },
  { cat: "rolls", uz: "Tempura roll", ru: "Темпура ролл", en: "Tempura Roll", price: 88000, cal: 420, weight: 250, ing: "Krevetka tempura, sir, avokado", allerg: "Qisqichbaqa, gluten", img: "tempura,roll", rating: 4.6, ratingCount: 58 },

  // ---------------- SUSHI ----------------
  { cat: "sushi", uz: "Losos bilan sushi", ru: "Суши с лососем", en: "Salmon Nigiri", price: 20000, cal: 90, weight: 45, ing: "Losos, guruch, nori", allerg: "Baliq", img: "salmon,nigiri", rating: 4.8, ratingCount: 140 },
  { cat: "sushi", uz: "Tunts bilan sushi", ru: "Суши с тунцом", en: "Tuna Nigiri", price: 17000, cal: 85, weight: 45, ing: "Tuna, guruch", allerg: "Baliq", img: "tuna,nigiri", rating: 4.7, ratingCount: 96 },
  { cat: "sushi", uz: "Losos bilan unagi", ru: "Суши с угрём", en: "Unagi Nigiri", price: 24000, cal: 110, weight: 48, ing: "Unagi, guruch, unagi sous", allerg: "Baliq, soya", img: "eel,sushi", rating: 4.7, ratingCount: 63 },
  { cat: "sushi", uz: "Krevetka nigiri", ru: "Нигири с креветкой", en: "Shrimp Nigiri", price: 22000, cal: 95, weight: 46, ing: "Krevetka, guruch", allerg: "Qisqichbaqa", img: "shrimp,sushi", popular: true, rating: 4.6, ratingCount: 74 },
  { cat: "sushi", uz: "Tuxumli sushi", ru: "Суши с яйцом", en: "Tamago Nigiri", price: 13000, cal: 100, weight: 50, ing: "Tamago, guruch", allerg: "Tuxum", img: "egg,sushi", rating: 4.2, ratingCount: 19 },
  { cat: "sushi", uz: "Avokado sushi", ru: "Суши с авокадо", en: "Avocado Nigiri", price: 13000, cal: 80, weight: 45, ing: "Avokado, guruch", allerg: "", img: "avocado,sushi", rating: 4.3, ratingCount: 22 },

  // ---------------- BAR ----------------
  { cat: "bar", uz: "Limonad marakuya", ru: "Лимонад маракуйя", en: "Passionfruit Lemonade", price: 28000, cal: 120, weight: 400, ing: "Marakuya, limon, soda", allerg: "", img: "lemonade", rating: 4.5, ratingCount: 33 },
  { cat: "bar", uz: "Yapon choyi", ru: "Японский чай", en: "Japanese Tea", price: 18000, cal: 5, weight: 350, ing: "Matcha, yasemin", allerg: "", img: "green,tea", rating: 4.6, ratingCount: 41 },
  { cat: "bar", uz: "Mojito (alkogolsiz)", ru: "Мохито (безалкогольный)", en: "Virgin Mojito", price: 32000, cal: 140, weight: 400, ing: "Laym, yalpiz, soda", allerg: "", img: "mojito", isNew: true, rating: 4.6, ratingCount: 28 },
  { cat: "bar", uz: "Sutli kokteyl", ru: "Молочный коктейль", en: "Milkshake", price: 35000, cal: 260, weight: 450, ing: "Sut, muzqaymoq, sirop", allerg: "Sut", img: "milkshake", rating: 4.7, ratingCount: 37 },

  // ---------------- BREAD & SIDES ----------------
  { cat: "bread", uz: "Qovurilgan non", ru: "Жареные булочки", en: "Fried Buns", price: 40000, cal: 220, weight: 180, ing: "Xamir, kunjut", allerg: "Gluten", img: "fried,bun", rating: 4.4, ratingCount: 21 },
  { cat: "bread", uz: "Tempura krevetkalar", ru: "Темпура с креветками", en: "Shrimp Tempura", price: 80000, cal: 310, weight: 200, ing: "Krevetka, tempura xamir", allerg: "Qisqichbaqa, gluten", img: "tempura,shrimp", popular: true, rating: 4.7, ratingCount: 55 },
  { cat: "bread", uz: "Karтофel fri", ru: "Картофель фри", en: "French Fries", price: 25000, cal: 340, weight: 180, ing: "Kartoshka, tuz", allerg: "", img: "french,fries", rating: 4.3, ratingCount: 40 },
  { cat: "bread", uz: "Chuka salad", ru: "Салат чука", en: "Chuka Salad", price: 35000, cal: 150, weight: 160, ing: "Chuka, kunjut, nori", allerg: "Soya", img: "seaweed,salad", rating: 4.5, ratingCount: 32 },
  { cat: "bread", uz: "Edamame", ru: "Эдамамэ", en: "Edamame", price: 28000, cal: 120, weight: 150, ing: "Edamame, tuz", allerg: "Soya", img: "edamame", rating: 4.4, ratingCount: 18 },
  { cat: "bread", uz: "Miso sho‘rva", ru: "Мисо суп", en: "Miso Soup", price: 30000, cal: 90, weight: 300, ing: "Miso, tofu, nori", allerg: "Soya", img: "miso,soup", rating: 4.5, ratingCount: 29 },

  // ---------------- DRINKS ----------------
  { cat: "drinks", uz: "Coca-Cola", ru: "Кока-Кола", en: "Coca-Cola", price: 15000, cal: 139, weight: 500, ing: "Gazli ichimlik", allerg: "", img: "coca-cola", popular: true, rating: 4.2, ratingCount: 88 },
  { cat: "drinks", uz: "Fanta", ru: "Фанта", en: "Fanta", price: 15000, cal: 145, weight: 500, ing: "Gazli ichimlik", allerg: "", img: "fanta,soda", rating: 4.1, ratingCount: 44 },
  { cat: "drinks", uz: "Sprite", ru: "Спрайт", en: "Sprite", price: 15000, cal: 140, weight: 500, ing: "Gazli ichimlik", allerg: "", img: "sprite,soda", rating: 4.0, ratingCount: 31 },
  { cat: "drinks", uz: "Maxito", ru: "Максито", en: "Maxito", price: 15000, cal: 150, weight: 500, ing: "Gazli ichimlik", allerg: "", img: "soda,can", rating: 4.1, ratingCount: 25 },
  { cat: "drinks", uz: "Mevali choy", ru: "Фруктовый чай", en: "Fruit Tea", price: 15000, cal: 130, weight: 500, ing: "Choy, tropik mevalar", allerg: "", img: "fruit,tea", rating: 4.6, ratingCount: 36 },
  { cat: "drinks", uz: "Mineral suv", ru: "Минеральная вода", en: "Mineral Water", price: 8000, cal: 0, weight: 500, ing: "Tabiiy suv", allerg: "", img: "water,bottle", rating: 4.0, ratingCount: 12 },

  // ---------------- SETS ----------------
  { cat: "sets", uz: "Yumi set", ru: "Сет Юми", en: "Yumi Set", price: 320000, old: 380000, cal: 1200, weight: 1200, ing: "4 x roll, 4 x sushi, chuka", allerg: "Baliq, sut, soya", img: "sushi,set", popular: true, promo: true, rating: 4.9, ratingCount: 68 },
  { cat: "sets", uz: "Nigiri set", ru: "Сет Нигири", en: "Nigiri Set", price: 180000, cal: 620, weight: 620, ing: "8 x nigiri, miso", allerg: "Baliq, soya", img: "nigiri,set", rating: 4.7, ratingCount: 34 },
  { cat: "sets", uz: "Filadelfiya set", ru: "Сет Филадельфия", en: "Philadelphia Set", price: 290000, old: 340000, cal: 980, weight: 980, ing: "3 x Filadelfiya, 8 x sushi", allerg: "Baliq, sut", img: "philadelphia,set", popular: true, promo: true, rating: 4.8, ratingCount: 51 },
  { cat: "sets", uz: "Oilaviy set", ru: "Семейный сет", en: "Family Set", price: 450000, cal: 1600, weight: 1600, ing: "6 x roll, 10 x sushi, drink", allerg: "Baliq, sut, soya", img: "sushi,platter", rating: 4.9, ratingCount: 42 },

  // ---------------- PROMO ----------------
  { cat: "promo", uz: "Sushi Set -20%", ru: "Суши Сет -20%", en: "Sushi Set -20%", price: 240000, old: 300000, cal: 900, weight: 900, ing: "Turli roll va sushi", allerg: "Baliq", img: "sushi,platter", promo: true, popular: true, rating: 4.8, ratingCount: 77 },
  { cat: "promo", uz: "2 ta poke biriga bepul", ru: "2 поке по цене одного", en: "2 Poke for 1", price: 190000, old: 240000, cal: 640, weight: 640, ing: "2 x poke", allerg: "Baliq", img: "poke,bowl", promo: true, rating: 4.7, ratingCount: 45 },
  { cat: "promo", uz: "Happy Hours -15%", ru: "Happy Hours -15%", en: "Happy Hours -15%", price: 0, old: 0, cal: 0, weight: 0, ing: "12:00–16:00 barcha rollarga", allerg: "", img: "happy,hour", promo: true, rating: 4.6, ratingCount: 20 },

  // ---------------- DESSERT ----------------
  { cat: "dessert", uz: "Mochi muzqaymoq", ru: "Моти мороженое", en: "Mochi Ice Cream", price: 30000, cal: 180, weight: 120, ing: "Guruch, muzqaymoq", allerg: "Sut", img: "mochi,dessert", popular: true, rating: 4.7, ratingCount: 39 },
  { cat: "dessert", uz: "Cheesecake", ru: "Чизкейк", en: "Cheesecake", price: 38000, cal: 320, weight: 150, ing: "Krem-sir, pechenye", allerg: "Sut, gluten", img: "cheesecake", rating: 4.8, ratingCount: 47 },
  { cat: "dessert", uz: "Chocolate lava", ru: "Шоколадный лава", en: "Chocolate Lava", price: 42000, cal: 400, weight: 160, ing: "Shokolad, tuxum", allerg: "Sut, tuxum, gluten", img: "chocolate,cake", isNew: true, rating: 4.7, ratingCount: 26 },
  { cat: "dessert", uz: "Fruit tart", ru: "Фруктовый тарт", en: "Fruit Tart", price: 35000, cal: 280, weight: 140, ing: "Mevalar, krem", allerg: "Sut, gluten", img: "fruit,tart", rating: 4.5, ratingCount: 18 },

  // ---------------- SALADS ----------------
  { cat: "salads", uz: "Sezar salat", ru: "Салат Цезарь", en: "Caesar Salad", price: 45000, cal: 260, weight: 220, ing: "Marul, tovuq, parmezan", allerg: "Sut, gluten", img: "caesar,salad", rating: 4.5, ratingCount: 33 },
  { cat: "salads", uz: "Grek salat", ru: "Греческий салат", en: "Greek Salad", price: 42000, cal: 200, weight: 220, ing: "Feta, zaytun, pomidor", allerg: "Sut", img: "greek,salad", rating: 4.4, ratingCount: 24 },
  { cat: "salads", uz: "Avokado salat", ru: "Салат с авокадо", en: "Avocado Salad", price: 48000, cal: 240, weight: 200, ing: "Avokado, chia, limon", allerg: "", img: "avocado,salad", isNew: true, rating: 4.6, ratingCount: 17 },
  { cat: "salads", uz: "Tovuqli salat", ru: "Салат с курицей", en: "Chicken Salad", price: 40000, cal: 230, weight: 210, ing: "Tovuq, sabzavotlar", allerg: "", img: "chicken,salad", rating: 4.3, ratingCount: 20 },

  // ---------------- BAKED ROLLS ----------------
  { cat: "baked", uz: "Achchiq zapechyonniy roll, unagi bilan", ru: "Запеченный острый ролл с угрём", en: "Baked Spicy Eel Roll", price: 60000, cal: 390, weight: 255, ing: "Unagi, sir, achchiq sous, guruch, nori", allerg: "Baliq, sut, soya", img: "baked,sushi,roll", popular: true, rating: 4.8, ratingCount: 64 },
  { cat: "baked", uz: "Achchiq zapechyonniy roll, losos bilan", ru: "Запечённый острый ролл с лососем", en: "Baked Spicy Salmon Roll", price: 60000, cal: 380, weight: 255, ing: "Losos, sir, achchiq sous, guruch, nori", allerg: "Baliq, sut, soya", img: "baked,roll", popular: true, rating: 4.8, ratingCount: 58 },
  { cat: "baked", uz: "Achchiq zapechyonniy roll, tunts bilan", ru: "Запеченный ролл острый с тунцом", en: "Baked Spicy Tuna Roll", price: 55000, cal: 360, weight: 250, ing: "Tuna, sir, achchiq sous, guruch", allerg: "Baliq, sut", img: "baked,tuna,roll", rating: 4.6, ratingCount: 41 },
  { cat: "baked", uz: "Pishloqli zapechyonniy roll, tovuq bilan", ru: "Запеченный ролл сырный с курицей", en: "Baked Cheese Chicken Roll", price: 55000, cal: 410, weight: 250, ing: "Tovuq, krem-sir, guruch, nori", allerg: "Sut, soya", img: "baked,chicken,roll", rating: 4.7, ratingCount: 47 },
  { cat: "baked", uz: "Pishloqli zapechyonniy roll, losos bilan", ru: "Запеченный ролл сырный с лососем", en: "Baked Cheese Salmon Roll", price: 60000, cal: 400, weight: 255, ing: "Losos, krem-sir, guruch, nori", allerg: "Baliq, sut", img: "baked,salmon,roll", popular: true, rating: 4.9, ratingCount: 72 },
  { cat: "baked", uz: "Pishloqli zapechyonniy roll, unagi bilan", ru: "Запеченный ролл сырный с угрём", en: "Baked Cheese Eel Roll", price: 60000, cal: 395, weight: 255, ing: "Unagi, krem-sir, guruch, nori", allerg: "Baliq, sut", img: "baked,eel,roll", rating: 4.8, ratingCount: 53 },
  { cat: "baked", uz: "Pishloqli zapechyonniy roll, tunts bilan", ru: "Запеченный ролл сырный с тунцом", en: "Baked Cheese Tuna Roll", price: 55000, cal: 375, weight: 250, ing: "Tuna, krem-sir, guruch, nori", allerg: "Baliq, sut", img: "baked,tuna", rating: 4.6, ratingCount: 38 },

  // ---------------- BAKED SUSHI ----------------
  { cat: "baked-sushi", uz: "Achchiq zapechyonniy sushi, losos bilan", ru: "Запечённый суши острый с лососем", en: "Baked Spicy Salmon Sushi", price: 25000, cal: 130, weight: 55, ing: "Losos, sir, achchiq sous, guruch", allerg: "Baliq, sut", img: "baked,sushi", popular: true, rating: 4.7, ratingCount: 45 },
  { cat: "baked-sushi", uz: "Achchiq zapechyonniy sushi, unagi bilan", ru: "Запечённый суши острый с угрём", en: "Baked Spicy Eel Sushi", price: 20000, cal: 125, weight: 55, ing: "Unagi, sir, achchiq sous, guruch", allerg: "Baliq, sut", img: "baked,eel,sushi", rating: 4.6, ratingCount: 30 },
  { cat: "baked-sushi", uz: "Achchiq zapechyonniy sushi, tunts bilan", ru: "Запечённый суши острый с тунцом", en: "Baked Spicy Tuna Sushi", price: 18000, cal: 120, weight: 55, ing: "Tuna, sir, achchiq sous, guruch", allerg: "Baliq, sut", img: "baked,tuna,sushi", rating: 4.5, ratingCount: 27 },
  { cat: "baked-sushi", uz: "Pishloqli zapechyonniy sushi, losos bilan", ru: "Запечённый суши сырный с лососем", en: "Baked Cheese Salmon Sushi", price: 25000, cal: 135, weight: 55, ing: "Losos, krem-sir, guruch", allerg: "Baliq, sut", img: "cheese,salmon,sushi", rating: 4.8, ratingCount: 36 },
  { cat: "baked-sushi", uz: "Pishloqli zapechyonniy sushi, unagi bilan", ru: "Запечённый суши сырный с угрём", en: "Baked Cheese Eel Sushi", price: 20000, cal: 130, weight: 55, ing: "Unagi, krem-sir, guruch", allerg: "Baliq, sut", img: "cheese,eel,sushi", rating: 4.7, ratingCount: 22 },
  { cat: "baked-sushi", uz: "Pishloqli zapechyonniy sushi, sir va tunts bilan", ru: "Запечённый суши сырный с сыром и тунцом", en: "Baked Cheese Tuna Sushi", price: 18000, cal: 140, weight: 58, ing: "Tuna, krem-sir, guruch", allerg: "Baliq, sut", img: "cheese,tuna,sushi", rating: 4.6, ratingCount: 19 },

  // ---------------- MAKI ----------------
  { cat: "maki", uz: "Maki losos bilan", ru: "Маки с лососем", en: "Salmon Maki", price: 35000, cal: 210, weight: 180, ing: "Losos, guruch, nori", allerg: "Baliq", img: "maki,salmon", popular: true, rating: 4.7, ratingCount: 52 },
  { cat: "maki", uz: "Maki unagi bilan", ru: "Маки с угрём", en: "Eel Maki", price: 35000, cal: 220, weight: 180, ing: "Unagi, kunjut, guruch, nori", allerg: "Baliq, soya", img: "maki,eel", rating: 4.6, ratingCount: 34 },
  { cat: "maki", uz: "Maki tunts bilan", ru: "Маки с тунцом", en: "Tuna Maki", price: 30000, cal: 200, weight: 175, ing: "Tuna, guruch, nori", allerg: "Baliq", img: "maki,tuna", rating: 4.5, ratingCount: 28 },
  { cat: "maki", uz: "Maki bodring va avokado bilan", ru: "Маки огурец-авокадо", en: "Cucumber Avocado Maki", price: 20000, cal: 160, weight: 170, ing: "Bodring, avokado, guruch, nori", allerg: "", img: "maki,avocado", rating: 4.4, ratingCount: 21 },

  // ---------------- SUSHI (сушки) ----------------
  { cat: "sushi", uz: "Sushki losos bilan", ru: "Сушки с лососем", en: "Salmon Sushi", price: 20000, cal: 95, weight: 45, ing: "Losos, guruch", allerg: "Baliq", img: "salmon,sushi,rice", rating: 4.6, ratingCount: 33 },
  { cat: "sushi", uz: "Sushki unagi bilan", ru: "Сушки с угрём", en: "Eel Sushi", price: 22000, cal: 100, weight: 46, ing: "Unagi, guruch, unagi sous", allerg: "Baliq, soya", img: "eel,sushi,rice", rating: 4.6, ratingCount: 26 },
  { cat: "sushi", uz: "Sushki tunts bilan", ru: "Сушки с тунцом", en: "Tuna Sushi", price: 17000, cal: 88, weight: 45, ing: "Tuna, guruch", allerg: "Baliq", img: "tuna,sushi,rice", rating: 4.5, ratingCount: 24 },
  { cat: "sushi", uz: "Sushki chuka bilan", ru: "Сушки с чукой", en: "Chuka Sushi", price: 13000, cal: 70, weight: 44, ing: "Chuka, guruch, nori", allerg: "Soya", img: "seaweed,sushi,rice", rating: 4.4, ratingCount: 18 },
];

export function buildCategories(): Category[] {
  return CATEGORY_DEFS.map((c, i) => ({
    id: "cat_" + c.slug,
    nameUz: c.uz,
    nameRu: c.ru,
    nameEn: c.en,
    slug: c.slug,
    icon: c.icon,
    image: foodImg(c.img, 100 + i),
    sortOrder: i,
    visible: true,
  }));
}

// Rough food-cost ratios by category, used to compute profit in reports.
const COST_RATIO: Record<string, number> = {
  drinks: 0.55,
  bar: 0.5,
  dessert: 0.5,
  bread: 0.45,
  salads: 0.45,
  sets: 0.44,
  promo: 0.44,
  sushi: 0.42,
  maki: 0.42,
  "baked-sushi": 0.43,
  baked: 0.43,
  rolls: 0.42,
  poke: 0.44,
};

export function buildProducts(): Product[] {
  return PRODUCTS.map((p, i) => {
    const cat = CATEGORY_DEFS.find((c) => c.slug === p.cat)!;
    return {
      id: "prd_" + (i + 1),
      categoryId: "cat_" + cat.slug,
      nameUz: p.uz,
      nameRu: p.ru,
      nameEn: p.en,
      descriptionUz: p.desc ?? `${p.ru} — yangi masalliqlardan tayyorlangan mazali taom.`,
      descriptionRu: p.desc ?? `${p.ru} — вкусное блюдо из свежих ингредиентов.`,
      descriptionEn: p.desc ?? `${p.en} — delicious dish made from fresh ingredients.`,
      price: p.price,
      oldPrice: p.old,
      cost: Math.round(p.price * (COST_RATIO[p.cat] ?? 0.45)),
      image: foodImg(p.img, i + 1),
      ingredients: p.ing,
      allergens: p.allerg,
      calories: p.cal,
      proteins: Math.round(p.weight * 0.12),
      fats: Math.round(p.weight * 0.08),
      carbs: Math.round(p.weight * 0.16),
      weight: p.weight,
      available: true,
      isPopular: !!p.popular,
      isNew: !!p.isNew,
      isPromotion: !!p.promo,
      sortOrder: i,
      rating: p.rating ?? 4.5,
      ratingCount: p.ratingCount ?? 25,
    };
  });
}

export function buildTables(): RestaurantTable[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: "tbl_" + (i + 1),
    number: i + 1,
    qrToken: "yumi-" + (i + 1) + "-" + randomToken(12),
    status: "EMPTY" as const,
    active: true,
    seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 2 : 4,
    zone: i < 8 ? "Zal" : i < 14 ? "Veranda" : "VIP",
  }));
}

export const DEFAULT_DEV = { username: "dev", password: "yumidev2026" };

// NOTE: the seeded password is the public demo credential from README.md.
// Stored values are hashed (see lib/hash.ts) — login still accepts the
// plaintext demo password because verification hashes the attempt.

/** The developer console signs in as this hidden account (password is random). */
export const DEV_STAFF_USERNAME = "__developer";

export function buildStaff(): Staff[] {
  const mk = (
    name: string,
    phone: string,
    username: string,
    password: string,
    role: Staff["role"]
  ): Staff => ({
    id: uid("stf"),
    name,
    phone,
    username,
    password: hashPassword(password),
    role,
    active: true,
    permissions: permissionsForRole(role),
    createdAt: Date.now(),
  });
  return [
    mk("Administrator", "+998 90 222 33 44", "admin", "admin123", "ADMIN"),
    mk("Aziz Rahimov", "+998 90 111 22 33", "aziz", "waiter123", "WAITER"),
    mk("Kamola Tosheva", "+998 90 444 55 66", "kamola", "waiter123", "WAITER"),
    // hidden developer account — only reachable through /yumidev
    mk("Developer", "—", DEV_STAFF_USERNAME, randomToken(20), "ADMIN"),
  ];
}

export const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "YÜMI",
  tagline: "SUSHI & ROLLS",
  description:
    "YÜMI — bu zamonaviy sushi va roll restorani. Biz sizga yangi, sifatli va mazali taomlarni taklif etamiz.",
  phone: "+998 90 123 45 67",
  instagram: "@yumi_sushi",
  telegram: "@yumi_sushi",
  address: "Tashkent, Yunusobod tumani, Amir Temur ko‘chasi, 12",
  mapsUrl: "https://maps.google.com/?q=Tashkent",
  workingHours: "Har kuni 10:00 – 23:00",
  deliveryInfo: "Yetkazib berish 30–60 daqiqa ichida.",
  deliveryFee: 15000,
  footerText: "© 2026 YÜMI. Barcha huquqlar himoyalangan.",
  currency: "so‘m",
  taxPercent: 0,
  servicePercent: 10,
};

export function buildSeedDB(): DB {
  const products = buildProducts();
  const tables = buildTables();
  const base: DB = {
    version: 3,
    staff: buildStaff(),
    tables,
    sessions: [],
    categories: buildCategories(),
    products,
    orders: [],
    calls: [],
    payments: [],
    promotions: [
      { id: uid("prom"), title: "Sushi Set -20%", description: "Barcha setlarga 20% chegirma", discountPct: 20, active: true, from: "2026-01-01", to: "2026-12-31" },
      { id: uid("prom"), title: "Happy Hours -15%", description: "12:00–16:00 oralig‘ida barcha rollarga 15% chegirma", discountPct: 15, active: true, from: "12:00", to: "16:00", happyHours: true },
      { id: uid("prom"), title: "PROMO10", description: "Promokod orqali 10% chegirma", discountPct: 10, code: "PROMO10", active: true, from: "2026-01-01", to: "2026-12-31" },
    ],
    logs: [
      {
        id: uid("log"),
        at: Date.now() - 3600_000,
        staffId: null,
        staffName: "Tizim",
        role: "SYSTEM",
        action: "Restoran tizimi ishga tushirildi",
        entity: "system",
      },
    ],
    notifications: [],
    settings: DEFAULT_SETTINGS,
    dev: { username: DEFAULT_DEV.username, password: hashPassword(DEFAULT_DEV.password) },
    counters: { orderNumber: 24 },
  };
  return withSampleData(base);
}

/**
 * Generates realistic historical + live demo orders so dashboards, reports and
 * the waiter/kitchen screens show meaningful data immediately.
 */
function withSampleData(db: DB): DB {
  const sellable = db.products.filter((p) => p.price > 0 && p.available);
  const waiters = db.staff.filter((s) => s.role === "WAITER" || s.role === "ADMIN");
  let orderNumber = db.counters.orderNumber;
  const orders: DB["orders"] = [];
  const payments: DB["payments"] = [];

  const methods = ["CASH", "CARD", "TERMINAL"] as const;

  const makeOrder = (createdAt: number, tableNo: number, count: number, opts?: { staffId?: string | null; type?: DB["orders"][number]["type"]; finalStatus?: DB["orders"][number]["status"] }) => {
    const table = db.tables.find((t) => t.number === tableNo) ?? db.tables[0];
    const items = Array.from({ length: count }, () => {
      const p = sellable[Math.floor(Math.random() * sellable.length)];
      return {
        id: uid("itm"),
        productId: p.id,
        nameUz: p.nameUz,
        nameRu: p.nameRu,
        nameEn: p.nameEn,
        price: p.price,
        cost: p.cost,
        qty: 1 + Math.floor(Math.random() * 2),
        delivered: true,
      };
    });
    // merge duplicates
    const merged: typeof items = [];
    for (const it of items) {
      const ex = merged.find((m) => m.productId === it.productId);
      if (ex) ex.qty += it.qty;
      else merged.push({ ...it });
    }
    const subtotal = merged.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal;
    orderNumber += 1;
    const status = opts?.finalStatus ?? "COMPLETED";
    const order: DB["orders"][number] = {
      id: uid("ord"),
      number: orderNumber,
      tableId: table.id,
      sessionId: null,
      tableLabel: `Stol ${table.number}`,
      type: opts?.type ?? "DINE_IN",
      status,
      items: merged,
      note: "",
      subtotal,
      discount: 0,
      total,
      paid: status === "COMPLETED",
      paymentMethod: status === "COMPLETED" ? methods[Math.floor(Math.random() * methods.length)] : undefined,
      createdByStaffId: opts?.staffId !== undefined ? opts.staffId : (Math.random() > 0.35 ? waiters[Math.floor(Math.random() * waiters.length)]?.id ?? null : null),
      customerToken: null,
      createdAt,
      updatedAt: createdAt + 25 * 60000,
      acceptedAt: createdAt + 2 * 60000,
      readyAt: createdAt + 18 * 60000,
      deliveredAt: createdAt + 22 * 60000,
      completedAt: status === "COMPLETED" ? createdAt + 30 * 60000 : undefined,
    };
    orders.push(order);
    if (order.paid) {
      payments.push({
        id: uid("pay"),
        orderIds: [order.id],
        tableId: table.id,
        tableNumber: table.number,
        amount: total,
        method: order.paymentMethod ?? "CASH",
        staffId: order.createdByStaffId,
        createdAt: order.completedAt ?? createdAt,
      });
    }
    return order;
  };

  // ---- historical completed orders (last 7 days) ----
  for (let d = 6; d >= 1; d--) {
    const dayOrders = 7 + Math.floor(Math.random() * 7);
    for (let i = 0; i < dayOrders; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      dt.setHours(10 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
      const tableNo = 1 + Math.floor(Math.random() * 20);
      const type = Math.random() > 0.85 ? "DELIVERY" : Math.random() > 0.8 ? "PREORDER" : "DINE_IN";
      makeOrder(dt.getTime(), tableNo, 2 + Math.floor(Math.random() * 4), { type });
    }
  }

  // ---- today: completed + live orders ----
  const now = Date.now();
  for (let i = 0; i < 14; i++) {
    makeOrder(now - (i + 1) * 47 * 60000, 1 + Math.floor(Math.random() * 20), 2 + Math.floor(Math.random() * 3));
  }
  const liveDefs: { table: number; items: number; status: DB["orders"][number]["status"] }[] = [
    { table: 5, items: 3, status: "PREPARING" },
    { table: 2, items: 2, status: "NEW" },
    { table: 8, items: 4, status: "READY" },
    { table: 12, items: 2, status: "NEW" },
    { table: 3, items: 3, status: "DELIVERED" },
  ];
  for (const def of liveDefs) {
    const o = makeOrder(now - Math.floor(Math.random() * 10 * 60000) - 60000, def.table, def.items, {
      finalStatus: def.status,
      staffId: waiters[Math.floor(Math.random() * waiters.length)]?.id ?? null,
    });
    o.paid = false;
    o.paymentMethod = undefined;
    o.completedAt = undefined;
  }

  // ---- waiter calls ----
  const calls: DB["calls"] = [
    { id: uid("call"), tableId: db.tables[6].id, tableNumber: 7, type: "WAITER", status: "PENDING", note: "Sous olib keling", createdAt: now - 4 * 60000, handledByStaffId: null },
    { id: uid("call"), tableId: db.tables[4].id, tableNumber: 5, type: "BILL", status: "PENDING", note: "Hisobni olib keling", createdAt: now - 2 * 60000, handledByStaffId: null },
    { id: uid("call"), tableId: db.tables[10].id, tableNumber: 11, type: "WAITER", status: "COMPLETED", note: "", createdAt: now - 40 * 60000, completedAt: now - 35 * 60000, handledByStaffId: waiters[0]?.id ?? null },
  ];

  // tables with live orders become occupied / bill
  const tableStatusMap = new Map<number, DB["tables"][number]["status"]>();
  for (const o of orders) {
    if (o.status === "COMPLETED" || o.status === "CANCELLED") continue;
    const t = db.tables.find((x) => x.id === o.tableId);
    if (t) tableStatusMap.set(t.number, o.status === "READY" ? "WAITING" : "OCCUPIED");
  }
  for (const call of calls) {
    if (call.type === "BILL" && call.status === "PENDING") tableStatusMap.set(call.tableNumber, "BILL");
  }

  return {
    ...db,
    orders: [...orders].sort((a, b) => b.createdAt - a.createdAt),
    payments: [...payments].sort((a, b) => b.createdAt - a.createdAt),
    calls,
    tables: db.tables.map((t) => (tableStatusMap.has(t.number) ? { ...t, status: tableStatusMap.get(t.number)! } : t)),
    counters: { orderNumber },
  };
}
