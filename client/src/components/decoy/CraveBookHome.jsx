import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  Flame,
  Star,
  Bookmark,
  ChefHat,
  Utensils,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { CRAVEBOOK_RECIPES, FEATURED_INDIAN_RECIPE } from './recipesData';
import DecoyButton from '../primitives/DecoyButton';
import PinNumpadModal from './PinNumpadModal';
import { apiRequest } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboard = React.lazy(() => import('../admin/AdminDashboard'));

const CATEGORIES = [
  'All',
  'Indian Curries & Dal',
  'Tandoori & Chaat',
  'Biryani & Breads',
  'South Indian',
  'Indo-Chinese',
  'Desserts & Drinks',
];

const getRecipeFallbackImage = (recipe) => {
  const safeTitle = String(recipe?.title || 'Chef Special')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 38);
  const safeCategory = String(recipe?.category || 'Indian Kitchen')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFF1F2"/>
        <stop offset="55%" stop-color="#FFE4E6"/>
        <stop offset="100%" stop-color="#FEF3C7"/>
      </linearGradient>
    </defs>
    <rect width="800" height="480" fill="url(#bg)"/>
    <rect x="34" y="34" width="180" height="32" rx="6" fill="#FFFFFF" stroke="#E11D48" stroke-width="1.2"/>
    <text x="124" y="55" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#9F1239">CRAVEBOOK KITCHEN</text>
    <text x="400" y="232" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" font-weight="700" fill="#171717">${safeTitle}</text>
    <text x="400" y="274" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="500" fill="#9F1239">${safeCategory}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const CraveBookHome = () => {
  const {
    alibiRecipeActive,
    setAlibiRecipeActive,
    hasSavepoint,
    resumeFromSavepoint,
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [savedIds, setSavedIds] = useState([
    'paneer-butter-masala',
    'veg-manchurian-gravy',
    'masala-dosa',
  ]);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [vaultTrigger, setVaultTrigger] = useState(false);
  const [adminTrigger, setAdminTrigger] = useState(false);
  const [matchedSecretWord, setMatchedSecretWord] = useState('');

  // When Alibi Panic Lock fires, immediately open "Paneer Butter Masala"
  useEffect(() => {
    if (alibiRecipeActive) {
      setSelectedRecipe(FEATURED_INDIAN_RECIPE);
      setSearchQuery('');
      setVaultTrigger(false);
      setAdminTrigger(false);
    }
  }, [alibiRecipeActive]);

  /**
   * Resolution 1: Standard Recipe Search Endpoint (`GET /api/v1/recipes?q=<query>`)
   * When query is "prodev", accesses the Admin Panel immediately.
   * When query matches secretWord, unlocks the PIN pad.
   */
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;

    const lower = trimmed.toLowerCase();
    if (lower === 'prodev') {
      setAdminTrigger(true);
      return;
    }
    if (lower === 'cutting chai' || lower === 'chai' || lower === 'secret') {
      setMatchedSecretWord('cutting chai');
      setVaultTrigger(true);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await apiRequest(`/recipes?q=${encodeURIComponent(trimmed)}`);
        if (data?.adminTrigger === true) {
          setAdminTrigger(true);
        } else if (data?.vaultTrigger === true) {
          setMatchedSecretWord(trimmed);
          setVaultTrigger(true);
        }
      } catch {
        // Fallback: check local secret trigger if server is sleeping
        if (lower === 'cutting chai' || lower.includes('cutting chai')) {
          setMatchedSecretWord('cutting chai');
          setVaultTrigger(true);
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (lower === 'prodev') {
      setAdminTrigger(true);
      return;
    }
    if (lower === 'cutting chai' || lower.includes('cutting chai')) {
      setMatchedSecretWord('cutting chai');
      setVaultTrigger(true);
      return;
    }
    try {
      const data = await apiRequest(`/recipes?q=${encodeURIComponent(trimmed)}`);
      if (data?.adminTrigger === true) {
        setAdminTrigger(true);
      } else if (data?.vaultTrigger === true) {
        setMatchedSecretWord(trimmed);
        setVaultTrigger(true);
      }
    } catch {
      // Continue standard recipe search
    }
  };

  const toggleSaveRecipe = (id) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleIngredient = (key) => {
    setCheckedIngredients((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredRecipes = CRAVEBOOK_RECIPES.filter((r) => {
    const matchesCat = activeCategory === 'All' || r.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.cuisine && r.cuisine.toLowerCase().includes(q)) ||
      (Array.isArray(r.ingredients) &&
        r.ingredients.some((ing) => ing.toLowerCase().includes(q)));
    return matchesCat && matchesSearch;
  });

  // Access Admin Panel via stealth keyword "prodev" - requires Master Password
  if (adminTrigger) {
    return (
      <React.Suspense
        fallback={
          <div className="flex h-[100dvh] w-full items-center justify-center bg-[#070A11] font-mono text-xs uppercase tracking-widest text-[#00F0FF]">
            [OPENING ADMIN STUDIO...]
          </div>
        }
      >
        <AdminDashboard
          initialAuthenticated={false}
          onExit={() => {
            setAdminTrigger(false);
            setSearchQuery('');
          }}
        />
      </React.Suspense>
    );
  }

  // Resolution 1: When vaultTrigger is true, unmount the recipe grid and mount the Brutalist PIN pad
  if (vaultTrigger) {
    return (
      <div className="min-h-[100dvh] bg-[#121212]">
        <PinNumpadModal
          isOpen={true}
          secretWord={matchedSecretWord || searchQuery.trim()}
          onClose={() => {
            setVaultTrigger(false);
            setSearchQuery('');
          }}
        />
      </div>
    );
  }

  // Detailed Recipe View (Also serves as the instant Alibi Panic Screen)
  if (selectedRecipe) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto overscroll-y-contain bg-[#FAFAFA] text-[#171717] font-sans">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 sm:px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setSelectedRecipe(null);
                setAlibiRecipeActive(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#525252] hover:text-[#171717]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Recipes</span>
              <span className="sm:hidden">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-[#E11D48]" />
              <span className="font-semibold tracking-tight text-[#171717]">CraveBook</span>
            </div>
            <div className="flex items-center gap-1.5">
              {hasSavepoint && (
                <button
                  type="button"
                  onClick={resumeFromSavepoint}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-[#9F1239] hover:bg-rose-100 transition-colors"
                  title="Resume saved session"
                >
                  <Bookmark className="h-3 w-3 fill-[#E11D48] text-[#E11D48]" />
                  Resume
                </button>
              )}
              <DecoyButton
                variant="secondary"
                onClick={() => toggleSaveRecipe(selectedRecipe.id)}
                className="!py-1.5 !px-3 text-xs"
              >
                <Bookmark
                  className={`mr-1.5 h-3.5 w-3.5 ${
                    savedIds.includes(selectedRecipe.id) ? 'fill-[#E11D48] text-[#E11D48]' : ''
                  }`}
                />
                {savedIds.includes(selectedRecipe.id) ? 'Saved' : 'Save'}
              </DecoyButton>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="relative h-56 sm:h-80 w-full">
              <img
                src={selectedRecipe.image}
                alt={selectedRecipe.title}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getRecipeFallbackImage(selectedRecipe);
                }}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-3 sm:left-4 top-3 sm:top-4 rounded-md bg-white/95 px-2.5 sm:px-3 py-1 text-xs font-semibold text-[#E11D48] shadow-sm">
                {selectedRecipe.category}
              </span>
              {selectedRecipe.cuisine && (
                <span className="absolute right-3 sm:right-4 top-3 sm:top-4 rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-[#171717] shadow-sm">
                  {selectedRecipe.cuisine}
                </span>
              )}
            </div>

            <div className="p-4 sm:p-8">
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#525252]">
                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {selectedRecipe.rating}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Prep: {selectedRecipe.prepTime} • Cook:{' '}
                  {selectedRecipe.cookTime}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-4 w-4 text-[#E11D48]" /> {selectedRecipe.calories}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Utensils className="h-4 w-4" /> {selectedRecipe.servings}
                </span>
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight text-[#171717]">
                {selectedRecipe.title}
              </h1>
              <p className="mt-2 text-base leading-relaxed text-[#525252]">
                {selectedRecipe.description}
              </p>

              <div className="mt-8 grid gap-8 md:grid-cols-12">
                <div className="md:col-span-5">
                  <h2 className="text-lg font-semibold text-[#171717] border-b border-neutral-200 pb-2">
                    Ingredients
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {selectedRecipe.ingredients.map((ing, idx) => {
                      const key = `${selectedRecipe.id}_${idx}`;
                      const checked = Boolean(checkedIngredients[key]);
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => toggleIngredient(key)}
                            className="flex w-full items-start gap-2.5 text-left text-sm text-[#171717] hover:text-[#E11D48]"
                          >
                            <CheckCircle2
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                checked ? 'text-[#E11D48]' : 'text-neutral-300'
                              }`}
                            />
                            <span className={checked ? 'line-through text-neutral-400' : ''}>
                              {ing}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="md:col-span-7">
                  <h2 className="text-lg font-semibold text-[#171717] border-b border-neutral-200 pb-2">
                    Chef&apos;s Method
                  </h2>
                  <ol className="mt-4 space-y-4">
                    {selectedRecipe.steps.map((step, idx) => (
                      <li
                        key={idx}
                        className="flex gap-3.5 rounded-lg border border-neutral-100 bg-neutral-50/70 p-3.5"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E11D48] text-xs font-semibold text-white">
                          {idx + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-[#171717]">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overscroll-y-contain bg-[#FAFAFA] text-[#171717] font-sans">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E11D48] text-white shadow-sm">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-semibold tracking-tight text-[#171717]">CraveBook</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasSavepoint && (
              <button
                type="button"
                onClick={resumeFromSavepoint}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-[#9F1239] hover:bg-rose-100 transition-colors"
                title="Resume saved session"
              >
                <Bookmark className="h-3.5 w-3.5 fill-[#E11D48] text-[#E11D48]" />
                <span>Resume</span>
              </button>
            )}
            <DecoyButton
              variant="secondary"
              onClick={() => setSelectedRecipe(FEATURED_INDIAN_RECIPE)}
              className="!py-1.5 !px-2.5 sm:!py-2 sm:!px-3 text-xs"
            >
              <Sparkles className="mr-1 sm:mr-1.5 h-3.5 w-3.5 text-[#E11D48]" />
              <span className="hidden sm:inline">Recipe of the Day</span>
              <span className="sm:hidden">Featured</span>
            </DecoyButton>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white px-3 sm:px-4 py-6 sm:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-[#E11D48] border border-rose-200">
            <Utensils className="h-3.5 w-3.5" /> Indian &amp; Indo-Chinese Restaurant Kitchen
          </span>
          <h1 className="mt-3 text-2xl sm:text-4xl font-semibold leading-tight text-[#171717]">
            What are you craving tonight?
          </h1>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#525252]">
            Browse restaurant-style Indian curries, tandoori starters, dosas, biryanis, fresh
            naans, smoky Indo-Chinese wok classics, and traditional desserts.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-5 sm:mt-6 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim().toLowerCase() === 'prodev') {
                    setAdminTrigger(true);
                  }
                }}
                placeholder="Search dishes or ingredients (e.g., paneer, hakka noodles)..."
                aria-label="Search recipes"
                className="w-full rounded-lg border border-neutral-300 bg-[#FAFAFA] py-2.5 sm:py-3 pl-10 pr-3 sm:pr-4 text-sm text-[#171717] placeholder-neutral-400 shadow-sm focus:border-[#E11D48] focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <DecoyButton type="submit" className="shrink-0 py-2.5 sm:py-3 px-4 sm:px-5 text-xs sm:text-sm">
              Search
            </DecoyButton>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#E11D48] text-white shadow-sm'
                    : 'bg-white text-[#525252] border border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <span className="shrink-0 text-xs font-medium text-[#525252]">
            Showing {filteredRecipes.length} recipes
          </span>
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 sm:p-10 text-center">
            <p className="text-base font-medium text-[#171717]">
              No matching recipes found for &ldquo;{searchQuery.trim()}&rdquo;.
            </p>
            <p className="mt-1 text-sm text-[#525252]">
              Try searching another dish like Paneer Butter Masala, Veg Manchurian, or Masala Dosa.
            </p>
            <DecoyButton
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="mt-4"
            >
              Show All Recipes
            </DecoyButton>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <article
                key={recipe.id}
                onClick={() => setSelectedRecipe(recipe)}
                className="group cursor-pointer overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md transition-transform hover:-translate-y-0.5"
              >
                <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getRecipeFallbackImage(recipe);
                    }}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#171717] shadow-sm">
                    {recipe.category}
                  </span>
                  <button
                    type="button"
                    aria-label={`Save ${recipe.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveRecipe(recipe.id);
                    }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#171717] shadow-sm hover:bg-white"
                  >
                    <Bookmark
                      className={`h-4 w-4 ${
                        savedIds.includes(recipe.id) ? 'fill-[#E11D48] text-[#E11D48]' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-[#525252]">
                    <span className="font-medium text-[#525252]">
                      {recipe.cuisine || recipe.calories}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {recipe.rating.split(' ')[0]}
                    </span>
                  </div>

                  <h2 className="mt-2 text-lg font-semibold leading-snug text-[#171717] group-hover:text-[#E11D48]">
                    {recipe.title}
                  </h2>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#525252]">
                    {recipe.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-[#525252]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {recipe.prepTime} + {recipe.cookTime}
                    </span>
                    <span className="font-semibold text-[#E11D48]">View Recipe →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-neutral-200 bg-white py-6 text-center text-xs text-[#525252]">
        <p>© 2026 CraveBook Kitchen Collective. Nutrition values are estimated per serving.</p>
      </footer>
    </div>
  );
};

export default CraveBookHome;
