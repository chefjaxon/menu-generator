/**
 * Static alias table for ingredient name normalization.
 *
 * Keys: lowercase variant forms (trimmed, as they appear in recipe ingredient lists).
 * Values: canonical ingredient name (singular, descriptive, minimal).
 *
 * Rules for entries:
 * - All keys must be lowercase.
 * - The canonical value should be singular, clear, and not include preparation
 *   adjectives unless they change the identity of the ingredient (e.g. "garlic powder"
 *   is a different product from "garlic").
 * - Identity entries (key === value) document that a specific form should NOT collapse
 *   to a broader category (e.g. "garlic powder" stays "garlic powder", not "garlic").
 * - To add new entries: add a lowercase key → canonical value pair and redeploy.
 */
export const INGREDIENT_ALIASES: Map<string, string> = new Map([
  // ── Chicken ──────────────────────────────────────────────────────────────
  ['chicken breast', 'chicken breast'],
  ['chicken breasts', 'chicken breast'],
  ['chicken breast halves', 'chicken breast'],
  ['boneless chicken breast', 'chicken breast'],
  ['boneless skinless chicken breast', 'chicken breast'],
  ['boneless skinless chicken breasts', 'chicken breast'],
  ['skinless boneless chicken breast', 'chicken breast'],
  ['skinless boneless chicken breasts', 'chicken breast'],
  ['chicken thigh', 'chicken thigh'],
  ['chicken thighs', 'chicken thigh'],
  ['boneless chicken thighs', 'chicken thigh'],
  ['boneless skinless chicken thighs', 'chicken thigh'],
  ['chicken tenders', 'chicken tender'],
  ['chicken strips', 'chicken tender'],

  // ── Garlic ───────────────────────────────────────────────────────────────
  ['garlic clove', 'garlic'],
  ['garlic cloves', 'garlic'],
  ['minced garlic', 'garlic'],
  ['fresh garlic', 'garlic'],
  ['crushed garlic', 'garlic'],
  ['garlic powder', 'garlic powder'],   // identity: different product
  ['garlic salt', 'garlic salt'],       // identity: different product

  // ── Olive oil ────────────────────────────────────────────────────────────
  ['olive oil', 'olive oil'],
  ['extra virgin olive oil', 'olive oil'],
  ['extra-virgin olive oil', 'olive oil'],
  ['evoo', 'olive oil'],
  ['light olive oil', 'olive oil'],

  // ── Other oils ───────────────────────────────────────────────────────────
  ['vegetable oil', 'vegetable oil'],
  ['canola oil', 'canola oil'],
  ['coconut oil', 'coconut oil'],
  ['avocado oil', 'avocado oil'],
  ['sesame oil', 'sesame oil'],
  ['toasted sesame oil', 'sesame oil'],

  // ── Butter ───────────────────────────────────────────────────────────────
  ['unsalted butter', 'butter'],
  ['salted butter', 'butter'],
  ['softened butter', 'butter'],
  ['melted butter', 'butter'],
  ['room temperature butter', 'butter'],

  // ── Onion ────────────────────────────────────────────────────────────────
  ['onion', 'onion'],
  ['onions', 'onion'],
  ['yellow onion', 'onion'],
  ['yellow onions', 'onion'],
  ['white onion', 'onion'],
  ['white onions', 'onion'],
  ['large onion', 'onion'],
  ['medium onion', 'onion'],
  ['small onion', 'onion'],
  ['diced onion', 'onion'],
  ['chopped onion', 'onion'],
  ['red onion', 'red onion'],
  ['red onions', 'red onion'],
  ['sweet onion', 'sweet onion'],
  ['vidalia onion', 'sweet onion'],
  ['green onion', 'green onion'],
  ['green onions', 'green onion'],
  ['scallion', 'green onion'],
  ['scallions', 'green onion'],

  // ── Tomato ───────────────────────────────────────────────────────────────
  ['tomato', 'tomato'],
  ['tomatoes', 'tomato'],
  ['roma tomato', 'roma tomato'],
  ['roma tomatoes', 'roma tomato'],
  ['cherry tomato', 'cherry tomato'],
  ['cherry tomatoes', 'cherry tomato'],
  ['grape tomatoes', 'grape tomato'],
  ['diced tomato', 'diced tomato'],
  ['diced tomatoes', 'diced tomato'],
  ['crushed tomatoes', 'crushed tomato'],
  ['crushed tomato', 'crushed tomato'],
  ['canned diced tomatoes', 'diced tomato'],
  ['canned crushed tomatoes', 'crushed tomato'],
  ['tomato paste', 'tomato paste'],
  ['tomato sauce', 'tomato sauce'],
  ['marinara sauce', 'marinara sauce'],

  // ── Bell pepper ──────────────────────────────────────────────────────────
  ['bell pepper', 'bell pepper'],
  ['bell peppers', 'bell pepper'],
  ['green bell pepper', 'bell pepper'],
  ['green bell peppers', 'bell pepper'],
  ['red bell pepper', 'red bell pepper'],
  ['red bell peppers', 'red bell pepper'],
  ['yellow bell pepper', 'yellow bell pepper'],
  ['orange bell pepper', 'orange bell pepper'],

  // ── Lemon & lime ─────────────────────────────────────────────────────────
  ['lemon', 'lemon'],
  ['lemons', 'lemon'],
  ['lemon juice', 'lemon juice'],
  ['fresh lemon juice', 'lemon juice'],
  ['lime', 'lime'],
  ['limes', 'lime'],
  ['lime juice', 'lime juice'],
  ['fresh lime juice', 'lime juice'],
  ['lemon zest', 'lemon zest'],
  ['lime zest', 'lime zest'],

  // ── Salt & pepper ────────────────────────────────────────────────────────
  ['salt', 'salt'],
  ['kosher salt', 'salt'],
  ['sea salt', 'salt'],
  ['table salt', 'salt'],
  ['pepper', 'pepper'],
  ['black pepper', 'pepper'],
  ['ground black pepper', 'pepper'],
  ['freshly ground black pepper', 'pepper'],
  ['ground pepper', 'pepper'],
  ['white pepper', 'white pepper'],
  ['salt and pepper', 'salt and pepper'],
  ['salt & pepper', 'salt and pepper'],
  ['salt and black pepper', 'salt and pepper'],
  ['salt and freshly ground black pepper', 'salt and pepper'],
  ['red pepper flakes', 'red pepper flakes'],
  ['crushed red pepper', 'red pepper flakes'],
  ['crushed red pepper flakes', 'red pepper flakes'],

  // ── Eggs ─────────────────────────────────────────────────────────────────
  ['egg', 'egg'],
  ['eggs', 'egg'],
  ['large egg', 'egg'],
  ['large eggs', 'egg'],
  ['whole egg', 'egg'],
  ['whole eggs', 'egg'],

  // ── Dairy ────────────────────────────────────────────────────────────────
  ['milk', 'milk'],
  ['whole milk', 'milk'],
  ['heavy cream', 'heavy cream'],
  ['heavy whipping cream', 'heavy cream'],
  ['whipping cream', 'heavy cream'],
  ['half and half', 'half and half'],
  ['sour cream', 'sour cream'],
  ['cream cheese', 'cream cheese'],

  // ── Cheese ───────────────────────────────────────────────────────────────
  ['parmesan', 'parmesan'],
  ['parmesan cheese', 'parmesan'],
  ['parmigiano reggiano', 'parmesan'],
  ['parmigiano-reggiano', 'parmesan'],
  ['shredded parmesan', 'parmesan'],
  ['grated parmesan', 'parmesan'],
  ['mozzarella', 'mozzarella'],
  ['mozzarella cheese', 'mozzarella'],
  ['shredded mozzarella', 'mozzarella'],
  ['fresh mozzarella', 'fresh mozzarella'],
  ['cheddar', 'cheddar'],
  ['cheddar cheese', 'cheddar'],
  ['shredded cheddar', 'cheddar'],
  ['feta', 'feta'],
  ['feta cheese', 'feta'],
  ['crumbled feta', 'feta'],

  // ── Broth / stock ────────────────────────────────────────────────────────
  ['chicken broth', 'chicken broth'],
  ['chicken stock', 'chicken broth'],
  ['low sodium chicken broth', 'chicken broth'],
  ['vegetable broth', 'vegetable broth'],
  ['vegetable stock', 'vegetable broth'],
  ['beef broth', 'beef broth'],
  ['beef stock', 'beef broth'],

  // ── Herbs ────────────────────────────────────────────────────────────────
  ['parsley', 'parsley'],
  ['fresh parsley', 'parsley'],
  ['flat-leaf parsley', 'parsley'],
  ['italian parsley', 'parsley'],
  ['cilantro', 'cilantro'],
  ['fresh cilantro', 'cilantro'],
  ['basil', 'basil'],
  ['fresh basil', 'basil'],
  ['dried basil', 'dried basil'],
  ['thyme', 'thyme'],
  ['fresh thyme', 'thyme'],
  ['dried thyme', 'thyme'],
  ['rosemary', 'rosemary'],
  ['fresh rosemary', 'rosemary'],
  ['dried rosemary', 'rosemary'],
  ['oregano', 'oregano'],
  ['dried oregano', 'oregano'],
  ['fresh oregano', 'oregano'],
  ['bay leaf', 'bay leaf'],
  ['bay leaves', 'bay leaf'],
  ['chives', 'chives'],
  ['fresh chives', 'chives'],
  ['dill', 'dill'],
  ['fresh dill', 'dill'],
  ['dried dill', 'dill'],

  // ── Spices ───────────────────────────────────────────────────────────────
  ['cumin', 'cumin'],
  ['ground cumin', 'cumin'],
  ['paprika', 'paprika'],
  ['smoked paprika', 'smoked paprika'],
  ['chili powder', 'chili powder'],
  ['cayenne', 'cayenne'],
  ['cayenne pepper', 'cayenne'],
  ['cinnamon', 'cinnamon'],
  ['ground cinnamon', 'cinnamon'],
  ['turmeric', 'turmeric'],
  ['ground turmeric', 'turmeric'],
  ['ginger', 'ginger'],
  ['ground ginger', 'ground ginger'],
  ['fresh ginger', 'fresh ginger'],
  ['coriander', 'coriander'],
  ['ground coriander', 'coriander'],
  ['allspice', 'allspice'],
  ['ground allspice', 'allspice'],

  // ── Sauces & condiments ──────────────────────────────────────────────────
  ['soy sauce', 'soy sauce'],
  ['low sodium soy sauce', 'soy sauce'],
  ['tamari', 'soy sauce'],
  ['worcestershire sauce', 'worcestershire sauce'],
  ['hot sauce', 'hot sauce'],
  ['dijon mustard', 'dijon mustard'],
  ['whole grain mustard', 'whole grain mustard'],
  ['yellow mustard', 'yellow mustard'],
  ['honey', 'honey'],
  ['maple syrup', 'maple syrup'],

  // ── Flour ────────────────────────────────────────────────────────────────
  ['flour', 'all-purpose flour'],
  ['all-purpose flour', 'all-purpose flour'],
  ['all purpose flour', 'all-purpose flour'],
  ['plain flour', 'all-purpose flour'],
  ['bread flour', 'bread flour'],
  ['whole wheat flour', 'whole wheat flour'],

  // ── Sugar ────────────────────────────────────────────────────────────────
  ['sugar', 'sugar'],
  ['white sugar', 'sugar'],
  ['granulated sugar', 'sugar'],
  ['brown sugar', 'brown sugar'],
  ['powdered sugar', 'powdered sugar'],
  ['confectioners sugar', 'powdered sugar'],
  ["confectioners' sugar", 'powdered sugar'],

  // ── Rice & grains ────────────────────────────────────────────────────────
  ['rice', 'rice'],
  ['white rice', 'white rice'],
  ['brown rice', 'brown rice'],
  ['jasmine rice', 'jasmine rice'],
  ['basmati rice', 'basmati rice'],

  // ── Pasta ────────────────────────────────────────────────────────────────
  ['pasta', 'pasta'],
  ['spaghetti', 'spaghetti'],
  ['penne', 'penne'],
  ['fettuccine', 'fettuccine'],
  ['linguine', 'linguine'],
  ['rigatoni', 'rigatoni'],

  // ── Identity-protection entries ───────────────────────────────────────────
  // These map a full phrase to itself so that the descriptor-stripping pass
  // cannot accidentally collapse them to a shorter, wrong ingredient name.
  // Example without protection: "ground beef" → strip "ground" → "beef" (WRONG)
  // With this entry: "ground beef" exact-matches the alias table BEFORE stripping
  // is applied inside normalizeIngredientName(), returning "ground beef" immediately.
  //
  // NOTE: normalizeIngredientName() does alias lookup AFTER stripping. To protect
  // these, the stripPreparationDescriptors() function preserves comma-free names
  // that still contain these words, and the alias table catches them if the full
  // phrase survives stripping. Add more entries here for any ingredient where a
  // "prep" word is actually part of the grocery identity.
  ['ground beef', 'ground beef'],
  ['ground pork', 'ground pork'],
  ['ground turkey', 'ground turkey'],
  ['ground lamb', 'ground lamb'],
  ['ground chicken', 'ground chicken'],
  ['ground veal', 'ground veal'],
  ['ground meat', 'ground meat'],
  ['cream cheese', 'cream cheese'],
  ['sour cream', 'sour cream'],
  ['ice cream', 'ice cream'],
  ['whipped cream', 'whipped cream'],
  ['heavy cream', 'heavy cream'],
  ['heavy whipping cream', 'heavy cream'],
  ['whipping cream', 'heavy cream'],
  ['dried cranberries', 'dried cranberry'],
  ['dried apricots', 'dried apricot'],
  ['dried figs', 'dried fig'],
  ['dried mango', 'dried mango'],
  ['dried cherries', 'dried cherry'],
  ['sun-dried tomatoes', 'sun-dried tomato'],
  ['sun dried tomatoes', 'sun-dried tomato'],
  ['roasted red peppers', 'roasted red pepper'],
  ['roasted garlic', 'roasted garlic'],
  ['smoked paprika', 'smoked paprika'],
  ['smoked salmon', 'smoked salmon'],
  ['smoked turkey', 'smoked turkey'],
  ['smoked bacon', 'bacon'],
  ['baked beans', 'baked beans'],
  ['fried rice', 'fried rice'],
  ['tomato paste', 'tomato paste'],
  ['tomato sauce', 'tomato sauce'],
  ['hot sauce', 'hot sauce'],
  ['soy sauce', 'soy sauce'],
  ['fish sauce', 'fish sauce'],
  ['oyster sauce', 'oyster sauce'],
  ['worcestershire sauce', 'worcestershire sauce'],
  ['bbq sauce', 'bbq sauce'],
  ['hoisin sauce', 'hoisin sauce'],
  ['peanut butter', 'peanut butter'],
  ['almond butter', 'almond butter'],
  ['tahini', 'tahini'],
  ['coconut milk', 'coconut milk'],
  ['coconut cream', 'coconut cream'],
  ['condensed milk', 'condensed milk'],
  ['evaporated milk', 'evaporated milk'],
  ['buttermilk', 'buttermilk'],
  ['cream of tartar', 'cream of tartar'],
]);

