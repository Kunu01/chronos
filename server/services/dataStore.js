import mongoose from 'mongoose';
import { createClient } from 'redis';
import bcrypt from 'bcryptjs';
import AppConfig from '../models/AppConfig.js';
import MemoryStation from '../models/MemoryStation.js';
import ChatMessage from '../models/ChatMessage.js';
import ActivityLog from '../models/ActivityLog.js';
import MusicTrack from '../models/MusicTrack.js';
import { deleteCloudinaryAssets } from './cloudinaryService.js';

let mongoConnected = false;
let redisClient = null;
let redisConnected = false;

const memoryCache = new Map();
let fallbackAppConfig = null;

// Standard Decoy Recipes served by GET /api/v1/recipes?q=<query>
export const DECOY_RECIPES = [
  {
    id: 'paneer-butter-masala',
    title: 'Paneer Butter Masala',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '420 kcal',
    rating: '4.9 (2,340 reviews)',
    image:
      'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80',
    description:
      'Velvety restaurant-style tomato, cashew, and Kashmiri red chili makhani gravy simmered with soft malai paneer cubes, aromatic kasuri methi, and sweet cream butter.',
  },
  {
    id: 'kadai-paneer',
    title: 'Kadai Paneer (Dhaba Style)',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '390 kcal',
    rating: '4.9 (1,680 reviews)',
    image:
      'https://images.unsplash.com/photo-1631452180775-4c5d06d7702b?auto=format&fit=crop&w=900&q=80',
    description:
      'Charred bell peppers, onion petals, and golden paneer tossed in a robust freshly pounded coriander-red chili kadai masala.',
  },
  {
    id: 'palak-paneer',
    title: 'Silky Dhaba Palak Paneer',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '340 kcal',
    rating: '4.8 (1,510 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    description:
      'Vibrant emerald blanched spinach puree gently spiced with cumin, browned garlic tadka, green chilies, and soft paneer cubes.',
  },
  {
    id: 'shahi-paneer',
    title: 'Mughlai Shahi Paneer',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '20 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '450 kcal',
    rating: '4.9 (1,190 reviews)',
    image:
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80',
    description:
      'Royal Mughlai curry of paneer simmered in saffron, melon-seed, cashew, and aromatic cardamom cream gravy.',
  },
  {
    id: 'matar-paneer',
    title: 'Homestyle Matar Paneer',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '365 kcal',
    rating: '4.8 (1,320 reviews)',
    image:
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
    description:
      'Sweet green peas and golden pan-seared paneer cubes braised in a spiced onion-tomato restaurant bhuna masala.',
  },
  {
    id: 'paneer-lababdar',
    title: 'Rich Paneer Lababdar',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '20 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '435 kcal',
    rating: '4.9 (1,540 reviews)',
    image:
      'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80',
    description:
      'Dual-textured North Indian classic featuring paneer batons and grated paneer simmered in spiced tomato-cashew masala with finely diced bell peppers.',
  },
  {
    id: 'malai-kofta',
    title: 'Royal Malai Kofta',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '25 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '470 kcal',
    rating: '4.9 (1,490 reviews)',
    image:
      'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=900&q=80',
    description:
      'Melt-in-mouth paneer, potato, and khoya dumplings stuffed with pistachios and golden raisins, nestled in silky saffron-cashew gravy, bound smoothly with cornflour.',
  },
  {
    id: 'kaju-curry',
    title: 'Shahi Roasted Kaju Masala',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '460 kcal',
    rating: '4.9 (1,120 reviews)',
    image:
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80',
    description:
      'Golden ghee-roasted whole cashews simmered in an opulent caramelized onion, tomato, and cardamom cashew-cream gravy.',
  },
  {
    id: 'kashmiri-dum-aloo',
    title: 'Spiced Kashmiri Dum Aloo',
    category: 'Indian Curries & Dal',
      cuisine: 'Kashmiri',
    prepTime: '20 mins',
    cookTime: '30 mins',
    servings: '4 servings',
    calories: '355 kcal',
    rating: '4.9 (1,390 reviews)',
    image:
      'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80',
    description:
      'Crisp golden baby potatoes slow-dum-cooked without onion or garlic in vibrant Kashmiri chili, fennel, dry ginger, and whisked yogurt gravy.',
  },
  {
    id: 'bhindi-do-pyaza',
    title: 'Restaurant Bhindi Do Pyaza',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '230 kcal',
    rating: '4.8 (1,080 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    description:
      'Non-sticky crisp pan-tossed okra (bhindi) cooked with two stages of sweet caramelized onions, tangy tomatoes, carom seeds, and amchur.',
  },
  {
    id: 'dal-makhani',
    title: '24-Hour Slow-Simmered Dal Makhani',
    category: 'Indian Curries & Dal',
      cuisine: 'Punjabi',
    prepTime: '20 mins (+ overnight soak)',
    cookTime: '1 hr 15 mins',
    servings: '6 servings',
    calories: '410 kcal',
    rating: '5.0 (2,890 reviews)',
    image:
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80',
    description:
      'Whole black urad lentils and red kidney beans slowly simmered with ripe tomato puree, white butter, ginger, and smoky dhungar finish.',
  },
  {
    id: 'dal-tadka',
    title: 'Restaurant Dal Tadka (Double Tempered)',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '295 kcal',
    rating: '4.9 (1,940 reviews)',
    image:
      'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=900&q=80',
    description:
      'Creamy yellow toor and moong lentils infused with aromatic ghee tempering of cumin, hing, browned garlic, dried red chilies, and kasuri methi.',
  },
  {
    id: 'amritsari-chole-bhature',
    title: 'Pindi Amritsari Chole & Fluffy Bhature',
    category: 'Indian Curries & Dal',
      cuisine: 'Punjabi',
    prepTime: '30 mins (+ soak)',
    cookTime: '40 mins',
    servings: '4 servings',
    calories: '540 kcal',
    rating: '4.9 (2,120 reviews)',
    image:
      'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=900&q=80',
    description:
      'Dark spiced Amritsari chickpeas infused with tea-amla aroma and roasted anardana, paired with puffed golden yogurt-fermented bhature.',
  },
  {
    id: 'rajma-masala',
    title: 'Jammu-Style Punjabi Rajma Masala',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins (+ soak)',
    cookTime: '45 mins',
    servings: '4 servings',
    calories: '360 kcal',
    rating: '4.8 (1,250 reviews)',
    image:
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
    description:
      'Creamy red kidney beans simmered in caramelized onion-tomato masala with cumin, coriander, and finishing butter.',
  },
  {
    id: 'aloo-gobi-adraki',
    title: 'Crispy Aloo Gobi Adraki',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '275 kcal',
    rating: '4.8 (980 reviews)',
    image:
      'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80',
    description:
      'Halwai-style roasted cauliflower florets and baby potatoes tossed with cumin, turmeric, crushed ginger juliennes, and tang of amchur.',
  },
  {
    id: 'baingan-bharta',
    title: 'Smoky Tandoori Baingan Bharta',
    category: 'Indian Curries & Dal',
      cuisine: 'Punjabi',
    prepTime: '15 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '240 kcal',
    rating: '4.8 (1,120 reviews)',
    image:
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80',
    description:
      'Flame-charred whole brinjal (baingan) mashed and bhuna-cooked with sweet peas, garlic, onions, tomatoes, and green chilies.',
  },
  {
    id: 'veg-kolhapuri',
    title: 'Fiery Veg Kolhapuri',
    category: 'Indian Curries & Dal',
      cuisine: 'Maharashtrian',
    prepTime: '20 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '330 kcal',
    rating: '4.8 (940 reviews)',
    image:
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
    description:
      'Mixed seasonal vegetables and paneer cubes coated in an aromatic roasted coconut, sesame, poppy seed, and Byadgi chili masala.',
  },
  {
    id: 'methi-matar-malai',
    title: 'Creamy Methi Matar Malai',
    category: 'Indian Curries & Dal',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '380 kcal',
    rating: '4.9 (1,070 reviews)',
    image:
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80',
    description:
      'Fragrant fenugreek greens and sweet winter peas folded into a velvety white cashew, cardamom, and malai cream sauce.',
  },
  {
    id: 'paneer-tikka-tandoori',
    title: 'Smoky Tandoori Paneer Tikka',
    category: 'Tandoori & Chaat',
      cuisine: 'North Indian',
    prepTime: '30 mins (+ marination)',
    cookTime: '15 mins',
    servings: '4 servings',
    calories: '320 kcal',
    rating: '5.0 (2,410 reviews)',
    image:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    description:
      'Char-grilled paneer cubes, onion petals, and bell peppers marinated in hung curd, ajwain, roasted besan, and Kashmiri chili.',
  },
  {
    id: 'veg-seekh-kabab',
    title: 'Tandoori Veg Seekh Kabab',
    category: 'Tandoori & Chaat',
      cuisine: 'North Indian',
    prepTime: '25 mins',
    cookTime: '15 mins',
    servings: '8 skewers',
    calories: '255 kcal',
    rating: '4.9 (1,210 reviews)',
    image:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    description:
      'Char-smoked skewered kebabs of finely minced carrots, French beans, sweet peas, crumbled paneer, and roasted chana sattu with mint-chili spice.',
  },
  {
    id: 'hara-bhara-kabab',
    title: 'Crispy Hara Bhara Kabab',
    category: 'Tandoori & Chaat',
      cuisine: 'North Indian',
    prepTime: '20 mins',
    cookTime: '15 mins',
    servings: '12 patties',
    calories: '245 kcal',
    rating: '4.8 (1,180 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    description:
      'Jewel-green pan-seared patties of spinach, sweet peas, boiled potato, and crumbled paneer topped with roasted cashew halves.',
  },
  {
    id: 'punjabi-samosa',
    title: 'Khasta Punjabi Aloo Samosa',
    category: 'Tandoori & Chaat',
      cuisine: 'Street Food',
    prepTime: '35 mins',
    cookTime: '20 mins',
    servings: '10 samosas',
    calories: '280 kcal',
    rating: '4.9 (2,650 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=80',
    description:
      'Flaky ajwain-scented pastry cones stuffed with spiced crushed potatoes, green peas, roasted coriander seeds, and cashews.',
  },
  {
    id: 'mumbai-pav-bhaji',
    title: 'Butter-Loaded Mumbai Pav Bhaji',
    category: 'Tandoori & Chaat',
      cuisine: 'Street Food',
    prepTime: '20 mins',
    cookTime: '25 mins',
    servings: '4 servings',
    calories: '490 kcal',
    rating: '5.0 (2,240 reviews)',
    image:
      'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80',
    description:
      'Velvety spiced mash of potatoes, cauliflower, peas, and beetroot cooked on a flat tawa with butter and toasted ladi pav.',
  },
  {
    id: 'mumbai-vada-pav',
    title: 'Classic Mumbai Batata Vada Pav',
    category: 'Tandoori & Chaat',
      cuisine: 'Street Food',
    prepTime: '20 mins',
    cookTime: '15 mins',
    servings: '6 vada pavs',
    calories: '380 kcal',
    rating: '4.9 (1,820 reviews)',
    image:
      'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80',
    description:
      'Crisp chickpea-battered spiced potato fritters tucked inside soft ladi pav with fiery dry garlic-peanut chutney and fried salted green chili.',
  },
  {
    id: 'aloo-tikki-chaat',
    title: 'Dilli Crispy Aloo Tikki Chaat',
    category: 'Tandoori & Chaat',
      cuisine: 'Street Food',
    prepTime: '25 mins',
    cookTime: '15 mins',
    servings: '4 plates',
    calories: '370 kcal',
    rating: '4.9 (1,460 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    description:
      'Ultra-crisp potato-lentil tikkis topped with whipped sweet yogurt, spiced chole, tamarind-date chutney, mint chutney, and pomegranate pearls.',
  },
  {
    id: 'dahi-bhalla-papdi-chaat',
    title: 'Old Delhi Dahi Bhalla Papdi Chaat',
    category: 'Tandoori & Chaat',
      cuisine: 'Street Food',
    prepTime: '30 mins (+ soak)',
    cookTime: '15 mins',
    servings: '6 servings',
    calories: '310 kcal',
    rating: '4.9 (1,340 reviews)',
    image:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    description:
      'Cloud-soft urad-moong lentil vadas soaked in creamy spiced curd with crisp wheat papdis, tangy chutneys, and jewel garnishes.',
  },
  {
    id: 'pani-puri-golgappa',
    title: 'Crispy Suji & Atta Pani Puri (Golgappa)',
    category: 'Tandoori & Chaat',
      cuisine: 'Street Food',
    prepTime: '25 mins',
    cookTime: '15 mins',
    servings: '36 puris',
    calories: '190 kcal',
    rating: '5.0 (2,980 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=80',
    description:
      'Hollow shatter-crisp semolina puris filled with spiced potato-kala chana masala, chilled pudina-tamarind theekha pani, and sweet khajoor meetha pani.',
  },
  {
    id: 'dahi-ke-sholey',
    title: 'Crispy Tandoori Dahi Ke Sholey',
    category: 'Tandoori & Chaat',
      cuisine: 'North Indian',
    prepTime: '25 mins',
    cookTime: '12 mins',
    servings: '8 rolls',
    calories: '290 kcal',
    rating: '4.9 (870 reviews)',
    image:
      'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=80',
    description:
      'Crunchy golden bread cones bursting with cool, spiced hung-curd, paneer, capsicum, and fresh herb filling—classic restaurant starter.',
  },
  {
    id: 'hyderabadi-veg-dum-biryani',
    title: 'Hyderabadi Subz Dum Biryani',
    category: 'Biryani & Breads',
      cuisine: 'Hyderabadi',
    prepTime: '35 mins',
    cookTime: '35 mins',
    servings: '6 servings',
    calories: '440 kcal',
    rating: '5.0 (2,540 reviews)',
    image:
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
    description:
      'Aged long-grain basmati rice slow-steamed on dum over spiced yogurt-marinated vegetables, paneer, caramelized birista onions, saffron, and mint.',
  },
  {
    id: 'mumbai-tawa-pulao',
    title: 'Street-Style Mumbai Tawa Pulao',
    category: 'Biryani & Breads',
      cuisine: 'Street Food',
    prepTime: '15 mins',
    cookTime: '15 mins',
    servings: '4 servings',
    calories: '385 kcal',
    rating: '4.9 (1,450 reviews)',
    image:
      'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80',
    description:
      'Fluffy basmati rice sizzling on a buttered tawa with crunchy vegetables, paneer cubes, Pav Bhaji Masala, and fiery Kashmiri garlic-chili paste.',
  },
  {
    id: 'kashmiri-pulao',
    title: 'Shahi Kashmiri Saffron Pulao',
    category: 'Biryani & Breads',
      cuisine: 'Kashmiri',
    prepTime: '20 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '395 kcal',
    rating: '4.8 (920 reviews)',
    image:
      'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80',
    description:
      'Fragrant basmati rice delicately spiced with fennel, dry ginger, saffron milk, ghee-roasted cashews, almonds, paneer, and jewel pomegranate.',
  },
  {
    id: 'jeera-rice',
    title: 'Fluffy Restaurant Jeera Rice',
    category: 'Biryani & Breads',
      cuisine: 'North Indian',
    prepTime: '15 mins',
    cookTime: '15 mins',
    servings: '4 servings',
    calories: '280 kcal',
    rating: '4.8 (1,620 reviews)',
    image:
      'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=900&q=80',
    description:
      'Separate, feather-light basmati rice tempered in pure desi ghee with crackling cumin seeds, bay leaf, and fresh coriander.',
  },
  {
    id: 'garlic-butter-naan',
    title: 'Garlic Butter Naan',
    category: 'Biryani & Breads',
      cuisine: 'North Indian',
    prepTime: '20 mins (+ 2h rise)',
    cookTime: '15 mins',
    servings: '8 naans',
    calories: '260 kcal',
    rating: '5.0 (2,780 reviews)',
    image:
      'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=900&q=80',
    description:
      'Pillowy blistered tandoori flatbread brushed with melted garlic butter and nigella seeds—leavened naturally with yogurt and milk.',
  },
  {
    id: 'lachha-paratha',
    title: 'Flaky Whole-Wheat Lachha Paratha',
    category: 'Biryani & Breads',
      cuisine: 'North Indian',
    prepTime: '25 mins',
    cookTime: '15 mins',
    servings: '6 parathas',
    calories: '295 kcal',
    rating: '4.9 (1,390 reviews)',
    image:
      'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=900&q=80',
    description:
      'Multi-layered golden tandoori flatbread pleated and brushed with pure ghee and ajwain until crisp on the outside and tender within.',
  },
  {
    id: 'amritsari-aloo-kulcha',
    title: 'Crispy Amritsari Stuffed Aloo Kulcha',
    category: 'Biryani & Breads',
      cuisine: 'Punjabi',
    prepTime: '30 mins (+ rest)',
    cookTime: '20 mins',
    servings: '6 kulchas',
    calories: '360 kcal',
    rating: '4.9 (1,480 reviews)',
    image:
      'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=900&q=80',
    description:
      'Crisp laminated flatbread stuffed with tangy anardana-spiced mashed potatoes, paneer, and green chilies, baked and crushed with white butter.',
  },
  {
    id: 'dhaba-aloo-paratha',
    title: 'Punjabi Dhaba Stuffed Aloo Paratha',
    category: 'Biryani & Breads',
      cuisine: 'Punjabi',
    prepTime: '20 mins',
    cookTime: '15 mins',
    servings: '6 parathas',
    calories: '320 kcal',
    rating: '4.9 (2,040 reviews)',
    image:
      'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=900&q=80',
    description:
      'Whole-wheat flatbread stuffed edge-to-edge with roasted-cumin, ajwain, ginger, and green-chili potato masala, roasted in desi ghee and crowned with white butter.',
  },
  {
    id: 'tandoori-roti',
    title: 'Crisp Whole-Wheat Tandoori Roti',
    category: 'Biryani & Breads',
      cuisine: 'North Indian',
    prepTime: '15 mins (+ rest)',
    cookTime: '10 mins',
    servings: '8 rotis',
    calories: '155 kcal',
    rating: '4.8 (1,510 reviews)',
    image:
      'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=900&q=80',
    description:
      'Char-blistered 100% whole-wheat tandoori flatbread crisped over open flame using traditional yeast-free dough, brushed optionally with pure butter.',
  },
  {
    id: 'masala-dosa',
    title: 'Crispy South Indian Masala Dosa',
    category: 'South Indian',
      cuisine: 'South Indian',
    prepTime: '25 mins (+ ferment)',
    cookTime: '20 mins',
    servings: '8 dosas',
    calories: '330 kcal',
    rating: '5.0 (2,610 reviews)',
    image:
      'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=900&q=80',
    description:
      'Paper-thin golden fermented rice-lentil crepes rolled around comforting turmeric-curry-leaf potato masala, served with hotel sambar and fresh coconut chutney.',
  },
  {
    id: 'rava-masala-dosa',
    title: 'Instant Lacy Rava Masala Dosa',
    category: 'South Indian',
      cuisine: 'South Indian',
    prepTime: '25 mins',
    cookTime: '15 mins',
    servings: '6 dosas',
    calories: '315 kcal',
    rating: '4.9 (1,480 reviews)',
    image:
      'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=900&q=80',
    description:
      'No-ferment crunchy semolina-rice lace crepes studded with whole black peppercorns, cumin, curry leaves, cashews, onions, and spiced potato filling.',
  },
  {
    id: 'idli-sambar-chutney',
    title: 'Soft Mallige Idli with Hotel Sambar',
    category: 'South Indian',
      cuisine: 'South Indian',
    prepTime: '20 mins (+ ferment)',
    cookTime: '20 mins',
    servings: '16 idlis',
    calories: '240 kcal',
    rating: '4.9 (1,950 reviews)',
    image:
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=900&q=80',
    description:
      'Pillow-soft steamed rice-urad cakes paired with aromatic drumstick-shallot Tiffin sambar, coconut chutney, and tomato-garlic kara chutney.',
  },
  {
    id: 'medu-vada',
    title: 'Crispy Urad Dal Medu Vada',
    category: 'South Indian',
      cuisine: 'South Indian',
    prepTime: '20 mins (+ soak)',
    cookTime: '15 mins',
    servings: '10 vadas',
    calories: '260 kcal',
    rating: '4.9 (1,380 reviews)',
    image:
      'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=900&q=80',
    description:
      'Golden crunchy lentil savory doughnuts speckled with crushed black pepper, ginger, curry leaves, and coconut bites.',
  },
  {
    id: 'onion-rava-uttapam',
    title: 'Onion Tomato Masala Uttapam',
    category: 'South Indian',
      cuisine: 'South Indian',
    prepTime: '15 mins',
    cookTime: '15 mins',
    servings: '6 uttapams',
    calories: '285 kcal',
    rating: '4.8 (1,040 reviews)',
    image:
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=900&q=80',
    description:
      'Thick, golden-edged fermented rice-lentil pancakes studded with caramelized sweet onions, juicy tomatoes, capsicum, green chilies, and idli podi.',
  },
  {
    id: 'veg-manchurian-gravy',
    title: 'Veg Manchurian (Gravy & Dry)',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '25 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '360 kcal',
    rating: '5.0 (2,810 reviews)',
    image:
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    description:
      'Crispy mixed cabbage-carrot-capsicum vegetable dumplings tossed in a glossy garlic, ginger, green chili, and dark soy Indo-Chinese sauce.',
  },
  {
    id: 'gobi-manchurian',
    title: 'Crispy Restaurant Gobi Manchurian',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '20 mins',
    cookTime: '18 mins',
    servings: '4 servings',
    calories: '345 kcal',
    rating: '4.9 (2,030 reviews)',
    image:
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    description:
      'Golden crunch-fried cauliflower florets glazed in smoky wok-tossed garlic, ginger, capsicum, dark soy, and red chili sauce.',
  },
  {
    id: 'chilli-paneer-dry',
    title: 'Street-Style Chilli Paneer Dry',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '20 mins',
    cookTime: '15 mins',
    servings: '4 servings',
    calories: '385 kcal',
    rating: '5.0 (2,490 reviews)',
    image:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    description:
      'Batter-crisped paneer cubes wok-tossed on high flame with bell pepper triangles, scallions, fiery green chilies, garlic, and glossy soy-chili glaze.',
  },
  {
    id: 'chilli-paneer-gravy',
    title: 'Restaurant Chilli Paneer Gravy',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '20 mins',
    cookTime: '18 mins',
    servings: '4 servings',
    calories: '405 kcal',
    rating: '4.9 (1,870 reviews)',
    image:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    description:
      'Golden cornflour-seared paneer and crisp bell peppers bathed in a rich glossy garlic-soy-chili broth made for pouring over Veg Fried Rice or Hakka Noodles.',
  },
  {
    id: 'veg-hakka-noodles',
    title: 'Smoky Street-Style Veg Hakka Noodles',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '15 mins',
    cookTime: '12 mins',
    servings: '4 servings',
    calories: '370 kcal',
    rating: '4.9 (2,310 reviews)',
    image:
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    description:
      'Bouncy wheat noodles tossed over blazing wok heat with crisp julienned cabbage, carrots, bell peppers, garlic, soy, and black pepper.',
  },
  {
    id: 'chilli-garlic-veg-noodles',
    title: 'Fiery Chilli Garlic Veg Noodles',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '15 mins',
    cookTime: '10 mins',
    servings: '4 servings',
    calories: '380 kcal',
    rating: '4.9 (1,740 reviews)',
    image:
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    description:
      'Bold spicy Indo-Chinese noodles infused with golden fried garlic, Kashmiri red chili paste, wok-charred cabbage, peppers, and scallions.',
  },
  {
    id: 'veg-schezwan-fried-rice',
    title: 'Veg Schezwan Fried Rice',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '15 mins',
    cookTime: '12 mins',
    servings: '4 servings',
    calories: '380 kcal',
    rating: '4.9 (1,980 reviews)',
    image:
      'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80',
    description:
      'Day-old long-grain rice wok-fried with homemade fiery Sichuan-garlic chili chutney, French beans, corn, carrots, and scallions.',
  },
  {
    id: 'burnt-garlic-veg-fried-rice',
    title: 'Burnt Garlic Veg Fried Rice',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '15 mins',
    cookTime: '10 mins',
    servings: '4 servings',
    calories: '350 kcal',
    rating: '4.9 (1,560 reviews)',
    image:
      'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80',
    description:
      'Aromatic restaurant-favorite vegetable fried rice perfumed with crisp toasted golden garlic chips, bok choy, broccoli, corn, and white pepper.',
  },
  {
    id: 'crispy-honey-chilli-potato',
    title: 'Crispy Honey Chilli Potato',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '20 mins',
    cookTime: '20 mins',
    servings: '4 servings',
    calories: '390 kcal',
    rating: '4.9 (2,150 reviews)',
    image:
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    description:
      'Double-fried ultra-crunchy potato fingers coated in toasted sesame, fiery garlic-red chili glaze, and sweet floral honey.',
  },
  {
    id: 'crispy-chilli-baby-corn',
    title: 'Crispy Chilli Baby Corn & Mushroom',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '20 mins',
    cookTime: '15 mins',
    servings: '4 servings',
    calories: '310 kcal',
    rating: '4.8 (1,140 reviews)',
    image:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    description:
      'Golden crunch-battered tender baby corn and button mushrooms wok-tossed in cracked black pepper, garlic, soy, and bell pepper glaze.',
  },
  {
    id: 'crispy-veg-salt-pepper',
    title: 'Crispy Veg Salt & Pepper (Chef Special)',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '20 mins',
    cookTime: '15 mins',
    servings: '4 servings',
    calories: '295 kcal',
    rating: '4.9 (1,290 reviews)',
    image:
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    description:
      'Bar-style crunchy medley of corn, baby corn, cauliflower, beans, and mushrooms dusted in aromatic Sichuan peppercorn-sea salt dry seasoning.',
  },
  {
    id: 'veg-spring-rolls',
    title: 'Golden Crispy Veg Spring Rolls',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '30 mins',
    cookTime: '15 mins',
    servings: '12 rolls',
    calories: '275 kcal',
    rating: '4.8 (1,410 reviews)',
    image:
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
    description:
      'Paper-thin spring roll pastry sheets rolled tightly around wok-charred cabbage, beansprouts, mushrooms, glass vermicelli, and sweet chili garlic filling.',
  },
  {
    id: 'veg-manchow-soup',
    title: 'Veg Manchow Soup with Crispy Noodles',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '15 mins',
    cookTime: '15 mins',
    servings: '4 bowls',
    calories: '175 kcal',
    rating: '5.0 (2,340 reviews)',
    image:
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80',
    description:
      'India’s favorite steaming savory dark soy-garlic vegetable broth topped with a generous crown of crunchy fried noodles.',
  },
  {
    id: 'hot-sour-veg-soup',
    title: 'Restaurant Hot & Sour Veg Soup',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '15 mins',
    cookTime: '12 mins',
    servings: '4 bowls',
    calories: '135 kcal',
    rating: '4.9 (1,360 reviews)',
    image:
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80',
    description:
      'Steaming dark-broth soup loaded with finely julienned carrots, cabbage, shiitake mushrooms, silky tofu, white pepper warmth, and bright chili vinegar.',
  },
  {
    id: 'sweet-corn-veg-soup',
    title: 'Creamy Indo-Chinese Sweet Corn Soup',
    category: 'Indo-Chinese',
      cuisine: 'Indo-Chinese',
    prepTime: '10 mins',
    cookTime: '12 mins',
    servings: '4 bowls',
    calories: '150 kcal',
    rating: '4.9 (1,530 reviews)',
    image:
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80',
    description:
      'Comforting golden velvet soup blending sweet corn puree and whole crunchy kernels with fine vegetable confetti and cracked black pepper.',
  },
  {
    id: 'gulab-jamun',
    title: 'Warm Kesar Khoya Gulab Jamun',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Desserts',
    prepTime: '20 mins',
    cookTime: '25 mins',
    servings: '16 jamuns',
    calories: '240 kcal',
    rating: '5.0 (2,640 reviews)',
    image:
      'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=900&q=80',
    description:
      'Melt-in-mouth caramelized khoya and chenna dumplings steeped in warm cardamom-saffron rose syrup.',
  },
  {
    id: 'kesar-rasmalai',
    title: 'Royal Kesar Pista Rasmalai',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Desserts',
    prepTime: '30 mins (+ chill)',
    cookTime: '25 mins',
    servings: '12 rasmalais',
    calories: '220 kcal',
    rating: '5.0 (1,890 reviews)',
    image:
      'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=900&q=80',
    description:
      'Feather-light spongy cottage-cheese discs poached in light syrup and chilled in golden saffron-cardamom rabri milk.',
  },
  {
    id: 'kesar-jalebi',
    title: 'Crisp Halwai Kesar Jalebi & Rabri',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Desserts',
    prepTime: '20 mins',
    cookTime: '20 mins',
    servings: '18 jalebis',
    calories: '260 kcal',
    rating: '4.9 (1,910 reviews)',
    image:
      'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=900&q=80',
    description:
      'Shatter-crisp spiraled saffron batter fried in desi ghee and dunked instantly in warm rose-cardamom sugar syrup, served beside chilled laccha rabri.',
  },
  {
    id: 'gajar-ka-halwa',
    title: 'Shahi Gajar Ka Halwa',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Desserts',
    prepTime: '20 mins',
    cookTime: '40 mins',
    servings: '6 servings',
    calories: '310 kcal',
    rating: '4.9 (1,760 reviews)',
    image:
      'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=900&q=80',
    description:
      'Winter red carrots slow-braised in full-cream milk, golden desi ghee, mawa khoya, cardamom, and roasted nuts.',
  },
  {
    id: 'malai-matka-kulfi',
    title: 'Traditional Malai Matka Kulfi',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Desserts',
    prepTime: '10 mins (+ freeze)',
    cookTime: '35 mins',
    servings: '6 matkas',
    calories: '250 kcal',
    rating: '5.0 (1,680 reviews)',
    image:
      'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?auto=format&fit=crop&w=900&q=80',
    description:
      'Dense, slow-reduced caramelized milk frozen in clay matkas—traditional Indian kulfi studded with cardamom, saffron, almonds, and pistachios.',
  },
  {
    id: 'masala-chai',
    title: 'Kadak Adrak Elaichi Masala Chai',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Beverages',
    prepTime: '5 mins',
    cookTime: '8 mins',
    servings: '2 mugs',
    calories: '110 kcal',
    rating: '5.0 (3,120 reviews)',
    image:
      'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80',
    description:
      'Robust Assam CTC tea brewed with freshly crushed ginger, green cardamom, cinnamon, cloves, and velvety milk.',
  },
  {
    id: 'south-indian-filter-kaapi',
    title: 'Authentic South Indian Filter Kaapi',
    category: 'Desserts & Drinks',
      cuisine: 'South Indian',
    prepTime: '15 mins (drip)',
    cookTime: '5 mins',
    servings: '2 davara cups',
    calories: '125 kcal',
    rating: '4.9 (1,540 reviews)',
    image:
      'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80',
    description:
      'Velvety 80:20 Coorg Peaberry coffee-chicory decoction whisked with scalded frothy full-fat milk and poured between brass davara-tumblers.',
  },
  {
    id: 'mango-lassi',
    title: 'Thick Alphonso Mango Lassi',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Beverages',
    prepTime: '8 mins',
    cookTime: '0 mins',
    servings: '2 tall glasses',
    calories: '215 kcal',
    rating: '4.9 (1,940 reviews)',
    image:
      'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=900&q=80',
    description:
      'Chilled restaurant favorite blending sweet Alphonso mango puree, creamy probiotic yogurt, green cardamom, and saffron.',
  },
  {
    id: 'masala-chaas',
    title: 'Spiced Pudina Tadka Masala Chaas',
    category: 'Desserts & Drinks',
      cuisine: 'Indian Beverages',
    prepTime: '7 mins',
    cookTime: '2 mins',
    servings: '2 tall glasses',
    calories: '85 kcal',
    rating: '4.9 (1,290 reviews)',
    image:
      'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=900&q=80',
    description:
      'Refreshing churned buttermilk cooler with fresh mint, coriander, roasted cumin, black salt, ginger, and optional sizzling mustard-curry-leaf tadka.',
  },
];

let fallbackStations = [];

let fallbackMessages = [];

let fallbackLogs = [
  {
    _id: 'log_seed_1',
    actor: 'SYSTEM',
    action: 'Chronos v3.0.0 Vault Engine initialized (Ready for custom milestone staging)',
    timestamp: new Date().toISOString(),
  },
];

export const initDataLayer = async () => {
  const [masterHash, herHash, hisHash] = await Promise.all([
    bcrypt.hash(process.env.DEFAULT_MASTER_PASSWORD || 'chronos2026', 8),
    bcrypt.hash(process.env.DEFAULT_HER_PIN || '123456', 8),
    bcrypt.hash(process.env.DEFAULT_HIS_PIN || '654321', 8),
  ]);

  fallbackAppConfig = {
    _id: 'singleton_config',
    masterPassword: masterHash,
    secretWord: (process.env.DEFAULT_SECRET_WORD || 'cutting chai').toLowerCase(),
    herPin: herHash,
    hisPin: hisHash,
    updatedAt: new Date().toISOString(),
  };

  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 2500, reconnectStrategy: false },
      });
      redisClient.on('error', () => {});
      await redisClient.connect();
      redisConnected = true;
      console.log('[CHRONOS] Connected to Redis cache');
    } catch {
      redisConnected = false;
      console.log('[CHRONOS] Redis unavailable — using sub-1ms RAM cache fallback');
    }
  }

  if (
    process.env.MONGO_URI &&
    !process.env.MONGO_URI.includes('<username>') &&
    !process.env.MONGO_URI.includes('your_')
  ) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 3500,
      });
      mongoConnected = true;
      console.log('[CHRONOS] Connected to MongoDB Atlas');
    } catch (err) {
      mongoConnected = false;
      console.log('[CHRONOS] MongoDB unavailable — using in-memory persistence:', err.message);
    }
  } else {
    console.log('[CHRONOS] Running with in-memory data store (configure MONGO_URI for Atlas)');
  }

  const cfg = await getAppConfig();
  if (cfg) {
    await cacheSet('app_config', JSON.stringify(cfg), 3600);
  }
  const stations = await getStationsFromDB();
  await cacheSet('timeline', JSON.stringify(stations), 3600);
};

// --- Cache Helpers ---
export const cacheGet = async (key) => {
  if (redisConnected && redisClient) {
    try {
      return await redisClient.get(key);
    } catch {
      return memoryCache.get(key) || null;
    }
  }
  return memoryCache.get(key) || null;
};

export const cacheSet = async (key, value, ttlSeconds = 3600) => {
  memoryCache.set(key, value);
  if (redisConnected && redisClient) {
    try {
      await redisClient.set(key, value, { EX: ttlSeconds });
    } catch {
      // Fallback already set
    }
  }
};

export const cacheDel = async (key) => {
  memoryCache.delete(key);
  if (redisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch {
      // Ignore
    }
  }
};

// --- AppConfig Operations ---
export const getAppConfig = async () => {
  const cached = await cacheGet('app_config');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // continue
    }
  }
  if (mongoConnected) {
    const doc = await AppConfig.findOne().lean();
    if (doc) {
      await cacheSet('app_config', JSON.stringify(doc), 3600);
    }
    return doc;
  }
  return fallbackAppConfig;
};

export const saveAppConfig = async ({ masterPasswordHash, secretWord, herPinHash, hisPinHash }) => {
  const normalizedWord = secretWord.trim().toLowerCase();
  if (mongoConnected) {
    let doc = await AppConfig.findOne();
    if (!doc) {
      doc = new AppConfig({
        masterPassword: masterPasswordHash,
        secretWord: normalizedWord,
        herPin: herPinHash,
        hisPin: hisPinHash,
        updatedAt: new Date(),
      });
    } else {
      if (masterPasswordHash) doc.masterPassword = masterPasswordHash;
      if (secretWord) doc.secretWord = normalizedWord;
      if (herPinHash) doc.herPin = herPinHash;
      if (hisPinHash) doc.hisPin = hisPinHash;
      doc.updatedAt = new Date();
    }
    await doc.save();
    const lean = doc.toObject();
    await cacheSet('app_config', JSON.stringify(lean), 3600);
    return lean;
  } else {
    fallbackAppConfig = {
      _id: 'singleton_config',
      masterPassword: masterPasswordHash || fallbackAppConfig?.masterPassword,
      secretWord: normalizedWord || fallbackAppConfig?.secretWord,
      herPin: herPinHash || fallbackAppConfig?.herPin,
      hisPin: hisPinHash || fallbackAppConfig?.hisPin,
      updatedAt: new Date().toISOString(),
    };
    await cacheSet('app_config', JSON.stringify(fallbackAppConfig), 3600);
    return fallbackAppConfig;
  }
};

export const resetGenesisState = async () => {
  if (mongoConnected) {
    await AppConfig.deleteMany({});
  }
  fallbackAppConfig = null;
  await cacheDel('app_config');
};

// --- MemoryStation CRUD & Backup/Restore Operations ---
const getStationsFromDB = async () => {
  if (mongoConnected) {
    return await MemoryStation.find().sort({ trackOrder: 1 }).lean();
  }
  return [...fallbackStations].sort((a, b) => a.trackOrder - b.trackOrder);
};

export const getTimelineStations = async () => {
  const cached = await cacheGet('timeline');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // continue
    }
  }
  const stations = await getStationsFromDB();
  await cacheSet('timeline', JSON.stringify(stations), 3600);
  return stations;
};

export const createMemoryStation = async ({
  stationTitle,
  milestoneDate,
  environmentTheme,
  secretLetter,
  asset,
  trackOrder,
}) => {
  if (mongoConnected) {
    const count = await MemoryStation.countDocuments();
    const nextOrder = typeof trackOrder === 'number' ? trackOrder : count;
    const created = await MemoryStation.create({
      trackOrder: nextOrder,
      stationTitle,
      milestoneDate: new Date(milestoneDate),
      environmentTheme: environmentTheme || 'autumn-night',
      secretLetter: secretLetter || '',
      assets: asset ? [asset] : [],
    });
    const all = await getStationsFromDB();
    await cacheSet('timeline', JSON.stringify(all), 3600);
    return created.toObject();
  } else {
    const nextOrder =
      typeof trackOrder === 'number'
        ? trackOrder
        : fallbackStations.length > 0
          ? Math.max(...fallbackStations.map((s) => s.trackOrder)) + 1
          : 0;
    const newStation = {
      _id: `station_${Date.now()}`,
      trackOrder: nextOrder,
      stationTitle,
      milestoneDate: new Date(milestoneDate).toISOString(),
      environmentTheme: environmentTheme || 'autumn-night',
      secretLetter: secretLetter || '',
      assets: asset ? [asset] : [],
    };
    fallbackStations.push(newStation);
    const all = await getStationsFromDB();
    await cacheSet('timeline', JSON.stringify(all), 3600);
    return newStation;
  }
};

export const updateMemoryStation = async (id, updates) => {
  if (mongoConnected) {
    const updated = await MemoryStation.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();
    const all = await getStationsFromDB();
    await cacheSet('timeline', JSON.stringify(all), 3600);
    return updated;
  } else {
    const idx = fallbackStations.findIndex((s) => String(s._id) === String(id));
    if (idx === -1) return null;
    fallbackStations[idx] = { ...fallbackStations[idx], ...updates };
    const all = await getStationsFromDB();
    await cacheSet('timeline', JSON.stringify(all), 3600);
    return fallbackStations[idx];
  }
};

export const appendStationAsset = async (id, asset) => {
  if (mongoConnected) {
    const updated = await MemoryStation.findByIdAndUpdate(
      id,
      { $push: { assets: asset } },
      { new: true }
    ).lean();
    const all = await getStationsFromDB();
    await cacheSet('timeline', JSON.stringify(all), 3600);
    return updated;
  } else {
    const idx = fallbackStations.findIndex((s) => String(s._id) === String(id));
    if (idx === -1) return null;
    fallbackStations[idx].assets = [...(fallbackStations[idx].assets || []), asset];
    const all = await getStationsFromDB();
    await cacheSet('timeline', JSON.stringify(all), 3600);
    return fallbackStations[idx];
  }
};

export const deleteMemoryStation = async (id) => {
  if (mongoConnected) {
    const doc = await MemoryStation.findByIdAndDelete(id).lean();
    if (doc?.assets?.length) {
      await deleteCloudinaryAssets(doc.assets);
    }
  } else {
    const target = fallbackStations.find((s) => String(s._id) === String(id));
    if (target?.assets?.length) {
      await deleteCloudinaryAssets(target.assets);
    }
    fallbackStations = fallbackStations.filter((s) => String(s._id) !== String(id));
  }
  const all = await getStationsFromDB();
  await cacheSet('timeline', JSON.stringify(all), 3600);
  return all;
};

export const restoreStationsBulk = async (stationsArray = []) => {
  if (!Array.isArray(stationsArray)) {
    throw new Error('Restore payload must contain an array of stations');
  }
  if (mongoConnected) {
    await MemoryStation.deleteMany({});
    const sanitized = stationsArray.map((s, idx) => ({
      trackOrder: typeof s.trackOrder === 'number' ? s.trackOrder : idx,
      stationTitle: s.stationTitle || `Station ${idx + 1}`,
      milestoneDate: s.milestoneDate ? new Date(s.milestoneDate) : new Date(),
      environmentTheme: s.environmentTheme || 'autumn-night',
      secretLetter: s.secretLetter || '',
      assets: Array.isArray(s.assets) ? s.assets : [],
    }));
    await MemoryStation.insertMany(sanitized);
  } else {
    fallbackStations = stationsArray.map((s, idx) => ({
      _id: s._id || `station_restored_${Date.now()}_${idx}`,
      trackOrder: typeof s.trackOrder === 'number' ? s.trackOrder : idx,
      stationTitle: s.stationTitle || `Station ${idx + 1}`,
      milestoneDate: s.milestoneDate
        ? new Date(s.milestoneDate).toISOString()
        : new Date().toISOString(),
      environmentTheme: s.environmentTheme || 'autumn-night',
      secretLetter: s.secretLetter || '',
      assets: Array.isArray(s.assets) ? s.assets : [],
    }));
  }
  const all = await getStationsFromDB();
  await cacheSet('timeline', JSON.stringify(all), 3600);
  return all;
};

// --- Ephemeral 24h Chat Operations ---
export const getRecentMessages = async (limit = 50) => {
  const cutoff = new Date(Date.now() - 86400 * 1000);
  if (mongoConnected) {
    const msgs = await ChatMessage.find({ createdAt: { $gte: cutoff } })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    return msgs.map((m) => ({
      _id: m._id,
      senderRole: m.senderRole,
      sender: m.senderRole,
      type: m.type,
      content: m.content,
      cloudinaryPublicId: m.cloudinaryPublicId || null,
      isRead: Boolean(m.isRead),
      createdAt: m.createdAt,
    }));
  } else {
    fallbackMessages = fallbackMessages.filter((m) => new Date(m.createdAt) >= cutoff);
    return fallbackMessages.slice(-limit).map((m) => ({
      ...m,
      isRead: Boolean(m.isRead),
    }));
  }
};

export const markChatMessagesRead = async (readerRole) => {
  const now = new Date();
  if (mongoConnected) {
    try {
      await ChatMessage.updateMany(
        { senderRole: { $ne: readerRole }, isRead: { $ne: true } },
        { $set: { isRead: true, readAt: now } }
      );
    } catch {
      // ignore
    }
  }
  fallbackMessages.forEach((m) => {
    if (m.senderRole !== readerRole) {
      m.isRead = true;
      m.readAt = now.toISOString();
    }
  });
  return { success: true };
};

export const addChatMessage = async ({
  senderRole,
  type = 'text',
  content,
  cloudinaryPublicId = null,
}) => {
  const now = new Date();
  if (mongoConnected) {
    const doc = await ChatMessage.create({
      senderRole,
      type,
      content,
      cloudinaryPublicId,
      isRead: false,
      createdAt: now,
    });
    return {
      _id: doc._id,
      senderRole: doc.senderRole,
      sender: doc.senderRole,
      type: doc.type,
      content: doc.content,
      cloudinaryPublicId: doc.cloudinaryPublicId,
      isRead: false,
      createdAt: doc.createdAt,
    };
  } else {
    const msg = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderRole,
      sender: senderRole,
      type,
      content,
      cloudinaryPublicId,
      isRead: false,
      createdAt: now.toISOString(),
    };
    fallbackMessages.push(msg);
    return msg;
  }
};

// --- Activity Log Operations ---
export const recordActivity = async (actor, action) => {
  const now = new Date();
  if (mongoConnected) {
    try {
      await ActivityLog.create({ actor, action, timestamp: now });
    } catch {
      // Ignore cap errors
    }
  }
  fallbackLogs.unshift({
    _id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actor,
    action,
    timestamp: now.toISOString(),
  });
  if (fallbackLogs.length > 200) {
    fallbackLogs.length = 200;
  }
};

export const getActivityLogs = async (limit = 50) => {
  if (mongoConnected) {
    return await ActivityLog.find().sort({ timestamp: -1 }).limit(limit).lean();
  }
  return fallbackLogs.slice(0, limit);
};

export const getSystemHealth = () => ({
  mongoConnected,
  redisConnected,
  cacheEngine: redisConnected ? 'Redis 7 AOF' : 'In-Memory Sub-1ms Cache',
  dbEngine: mongoConnected ? 'MongoDB Atlas M0' : 'In-Memory Vault Store',
});

// --- Station Purge / Clean Slate ---
export const purgeAllStations = async () => {
  if (mongoConnected) {
    await MemoryStation.deleteMany({});
  }
  fallbackStations = [];
  await cacheDel('timeline');
  await recordActivity('ADMIN', 'Purged all milestone stations — Clean Slate initialized');
  return [];
};

// --- Background Music Playlist Store ---
let fallbackTracks = [
  {
    _id: 'default_ambient_track_1',
    title: 'Warm Memories (Piano Ambient)',
    artist: 'Project Chronos Soft Tune',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    publicId: null,
    order: 0,
    createdAt: new Date().toISOString(),
  },
];

export const getPlaylistTracks = async () => {
  const cached = await cacheGet('playlist_tracks');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // continue
    }
  }
  if (mongoConnected) {
    const tracks = await MusicTrack.find().sort({ order: 1, createdAt: 1 }).lean();
    if (tracks.length > 0) {
      await cacheSet('playlist_tracks', JSON.stringify(tracks), 3600);
      return tracks;
    }
  }
  return fallbackTracks;
};

export const addPlaylistTrack = async ({ title, artist, url, publicId }) => {
  const current = await getPlaylistTracks();
  const nextOrder = current.length;

  if (mongoConnected) {
    const doc = await MusicTrack.create({
      title: title.trim(),
      artist: (artist || 'Ambient Soundscape').trim(),
      url,
      publicId: publicId || null,
      order: nextOrder,
      createdAt: new Date(),
    });
    const item = doc.toObject();
    await cacheDel('playlist_tracks');
    await recordActivity('ADMIN', `Added background music track: "${item.title}"`);
    return item;
  } else {
    const track = {
      _id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      artist: (artist || 'Ambient Soundscape').trim(),
      url,
      publicId: publicId || null,
      order: nextOrder,
      createdAt: new Date().toISOString(),
    };
    fallbackTracks.push(track);
    await cacheDel('playlist_tracks');
    await recordActivity('ADMIN', `Added background music track: "${track.title}" (RAM)`);
    return track;
  }
};

export const deletePlaylistTrack = async (id) => {
  if (mongoConnected) {
    const doc = await MusicTrack.findById(id);
    if (doc) {
      if (doc.publicId) {
        await deleteCloudinaryAssets([doc.publicId]).catch(() => {});
      }
      await MusicTrack.findByIdAndDelete(id);
      await cacheDel('playlist_tracks');
      await recordActivity('ADMIN', `Removed background music track: "${doc.title}"`);
      return true;
    }
  }
  const idx = fallbackTracks.findIndex((t) => t._id === id);
  if (idx !== -1) {
    const [removed] = fallbackTracks.splice(idx, 1);
    await cacheDel('playlist_tracks');
    await recordActivity('ADMIN', `Removed background music track: "${removed.title}" (RAM)`);
    return true;
  }
  return false;
};
