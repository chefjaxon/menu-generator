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
  ['fresh basil', 'fresh basil'],
  ['dried basil', 'dried basil'],
  ['thyme', 'thyme'],
  ['fresh thyme', 'fresh thyme'],
  ['dried thyme', 'dried thyme'],
  ['rosemary', 'rosemary'],
  ['fresh rosemary', 'fresh rosemary'],
  ['dried rosemary', 'dried rosemary'],
  ['oregano', 'oregano'],
  ['dried oregano', 'dried oregano'],
  ['fresh oregano', 'fresh oregano'],
  ['bay leaf', 'bay leaf'],
  ['bay leaves', 'bay leaf'],
  ['chives', 'chives'],
  ['fresh chives', 'chives'],
  ['dill', 'dill'],
  ['fresh dill', 'fresh dill'],
  ['dried dill', 'dried dill'],

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

  // ── From Recipe Keeper import (your 1,286 recipe database) ───────────────

  // ── Cilantro ─────────────────────────────────────────────────────────────
  ['chopped cilantro', 'cilantro'],
  ['chopped fresh cilantro', 'cilantro'],
  ['fresh cilantro', 'cilantro'],
  ['fresh cilantro leaves', 'cilantro'],

  // ── Parsley ──────────────────────────────────────────────────────────────
  ['chopped flat-leaf parsley', 'parsley'],
  ['chopped fresh parsley', 'parsley'],
  ['chopped parsley', 'parsley'],
  ['fresh parsley for serving', 'parsley'],
  ['fresh parsley leaves', 'parsley'],

  // ── Rosemary ─────────────────────────────────────────────────────────────
  ['chopped fresh rosemary', 'fresh rosemary'],
  ['finely chopped fresh rosemary leaves', 'fresh rosemary'],
  ['fresh rosemary leaves', 'fresh rosemary'],
  ['fresh rosemary sprigs', 'fresh rosemary'],

  // ── Oregano ──────────────────────────────────────────────────────────────
  ['chopped oregano leaves', 'fresh oregano'],
  ['fresh oregano', 'fresh oregano'],
  ['fresh oregano leaves', 'fresh oregano'],

  // ── Thyme ────────────────────────────────────────────────────────────────
  ['chopped thyme leaves', 'fresh thyme'],
  ['fresh thyme leaves', 'fresh thyme'],

  // ── Dill ─────────────────────────────────────────────────────────────────
  ['dill - finely chopped', 'fresh dill'],
  ['finely chopped fresh dill', 'fresh dill'],
  ['fresh dill fronds', 'fresh dill'],

  // ── Basil ────────────────────────────────────────────────────────────────
  ['fresh basil leaves', 'fresh basil'],

  // ── Chives ───────────────────────────────────────────────────────────────
  ['fresh chives', 'chives'],

  // ── Fresh ginger ─────────────────────────────────────────────────────────
  ['fresh ginger', 'fresh ginger'],
  ['freshly grated ginger', 'fresh ginger'],
  ['grated fresh ginger', 'fresh ginger'],
  ['grated ginger', 'fresh ginger'],

  // ── Garlic (additional variants) ─────────────────────────────────────────
  ['garlic clove - grated or minced', 'garlic'],
  ['large garlic clove', 'garlic'],
  ['large garlic cloves', 'garlic'],
  ['roasted garlic cloves', 'garlic'],
  ['small garlic clove', 'garlic'],
  ['whole head garlic', 'garlic'],

  // ── Onion (additional variants) ──────────────────────────────────────────
  ['medium yellow onion', 'onion'],
  ['small yellow onion', 'onion'],
  ['yellow onion', 'onion'],

  // ── Red onion (additional variants) ──────────────────────────────────────
  ['small red onion', 'red onion'],
  ['small red onion - finely chopped', 'red onion'],

  // ── Scallion (additional variants) ───────────────────────────────────────
  ['thinly sliced scallions', 'green onion'],
  ['scallions', 'green onion'],

  // ── Carrot ───────────────────────────────────────────────────────────────
  ['carrot', 'carrot'],
  ['carrots', 'carrot'],
  ['large carrot', 'carrot'],
  ['large carrots', 'carrot'],
  ['medium carrot', 'carrot'],

  // ── Celery ───────────────────────────────────────────────────────────────
  ['celery', 'celery'],
  ['celery stalks', 'celery'],

  // ── Zucchini ─────────────────────────────────────────────────────────────
  ['zucchini', 'zucchini'],
  ['diced zucchini', 'zucchini'],
  ['large zucchini', 'zucchini'],
  ['medium zucchini', 'zucchini'],
  ['small zucchini', 'zucchini'],

  // ── Spinach ──────────────────────────────────────────────────────────────
  ['baby spinach', 'spinach'],
  ['fresh spinach', 'spinach'],
  ['spinach', 'spinach'],

  // ── Cauliflower ──────────────────────────────────────────────────────────
  ['cauliflower', 'cauliflower'],
  ['large head cauliflower', 'cauliflower'],
  ['medium head cauliflower', 'cauliflower'],

  // ── Sweet potato (additional variants) ───────────────────────────────────
  ['large sweet potatoes', 'sweet potato'],
  ['sweet potatoes', 'sweet potato'],
  ['sweet potato', 'sweet potato'],

  // ── Mushroom ─────────────────────────────────────────────────────────────
  ['mushroom', 'mushroom'],
  ['cremini mushrooms', 'mushroom'],
  ['mushrooms quartered', 'mushroom'],
  ['sliced mushrooms', 'mushroom'],

  // ── Cherry tomato (additional variants) ──────────────────────────────────
  ['cherry tomatoes', 'cherry tomato'],

  // ── Diced tomato (additional variants) ───────────────────────────────────
  ['canned diced tomatoes', 'diced tomato'],

  // ── Whole peeled tomato ───────────────────────────────────────────────────
  ['whole peeled tomato', 'whole peeled tomato'],
  ['can san marzano whole peeled tomatoes', 'whole peeled tomato'],
  ['can whole peeled tomatoes', 'whole peeled tomato'],

  // ── Red bell pepper (additional variants) ────────────────────────────────
  ['medium red bell pepper', 'red bell pepper'],
  ['red bell pepper - finely chopped', 'red bell pepper'],

  // ── Sweet corn ───────────────────────────────────────────────────────────
  ['sweet corn', 'sweet corn'],
  ['can of sweet corn', 'sweet corn'],
  ['sweet corn kernels', 'sweet corn'],

  // ── Apple ────────────────────────────────────────────────────────────────
  ['apple', 'apple'],
  ['large honeycrisp apples', 'apple'],

  // ── Jalapeño ─────────────────────────────────────────────────────────────
  ['jalapeño', 'jalapeño'],
  ['jalapeños', 'jalapeño'],

  // ── Shrimp ───────────────────────────────────────────────────────────────
  ['shrimp', 'shrimp'],
  ['large shrimp', 'shrimp'],
  ['shrimp with shells', 'shrimp'],

  // ── Egg (additional variants) ─────────────────────────────────────────────
  ['large eggs', 'egg'],

  // ── Salt (additional variants) ────────────────────────────────────────────
  ['flaky sea salt', 'salt'],
  ['smoked sea salt', 'salt'],
  ['salt to taste', 'salt'],

  // ── Black pepper (additional variants) ───────────────────────────────────
  ['black pepper', 'pepper'],
  ['black pepper to taste', 'pepper'],
  ['freshly cracked black pepper', 'pepper'],
  ['freshly cracked black pepper to taste', 'pepper'],

  // ── Salt and pepper combos ────────────────────────────────────────────────
  ['salt & pepper', 'salt and pepper'],
  ['salt + pepper to taste', 'salt and pepper'],
  ['salt and black pepper', 'salt and pepper'],
  ['salt and pepper to taste', 'salt and pepper'],
  ['salt to taste', 'salt'],
  ['kosher salt and black pepper', 'salt and pepper'],
  ['sea salt & freshly ground black pepper', 'salt and pepper'],

  // ── Butter (additional variants) ──────────────────────────────────────────

  // ── Olive oil (additional variants) ──────────────────────────────────────
  ['extra-virgin olive oil', 'olive oil'],

  // ── Sesame oil (additional variants) ─────────────────────────────────────
  ['toasted sesame oil', 'sesame oil'],

  // ── Sesame seeds ─────────────────────────────────────────────────────────
  ['sesame seeds', 'sesame seeds'],
  ['toasted sesame seeds', 'sesame seeds'],

  // ── Coconut milk (additional variants) ───────────────────────────────────
  ['canned full fat coconut milk', 'coconut milk'],
  ['full-fat coconut milk', 'coconut milk'],

  // ── Greek yogurt ─────────────────────────────────────────────────────────
  ['greek yogurt', 'greek yogurt'],
  ['full-fat greek yogurt', 'greek yogurt'],
  ['full-fat plain greek yogurt', 'greek yogurt'],
  ['whole-milk greek yogurt', 'greek yogurt'],

  // ── Milk (additional variants) ────────────────────────────────────────────
  ['whole milk', 'milk'],

  // ── Ricotta ──────────────────────────────────────────────────────────────
  ['ricotta', 'ricotta'],
  ['whole-milk ricotta', 'ricotta'],
  ['whole-milk ricotta cheese', 'ricotta'],

  // ── Parmesan (additional variants) ───────────────────────────────────────
  ['freshly grated parmesan or pecorino', 'parmesan'],
  ['freshly grated parmigiano-reggiano', 'parmesan'],
  ['grated parmesan cheese', 'parmesan'],

  // ── Mozzarella (additional variants) ─────────────────────────────────────
  ['shredded mozzarella cheese', 'mozzarella'],

  // ── Feta (additional variants) ────────────────────────────────────────────
  ['feta cheese', 'feta'],

  // ── Chicken broth (additional variants) ──────────────────────────────────
  ['chicken stock', 'chicken broth'],

  // ── Soy sauce (additional variants) ──────────────────────────────────────
  ['low-sodium soy sauce', 'soy sauce'],

  // ── Dijon mustard (additional variants) ──────────────────────────────────
  ['whole-grain dijon mustard', 'dijon mustard'],

  // ── Lemon juice (additional variants) ─────────────────────────────────────
  ['fresh lemon juice', 'lemon juice'],

  // ── Lemon zest ────────────────────────────────────────────────────────────
  ['lemon zest', 'lemon zest'],
  ['fresh lemon zest', 'lemon zest'],
  ['finely grated lemon zest', 'lemon zest'],

  // ── Lemon (the fruit) ────────────────────────────────────────────────────
  ['lemons', 'lemon'],

  // ── Lime juice (additional variants) ──────────────────────────────────────
  ['fresh lime juice', 'lime juice'],

  // ── Lime zest ────────────────────────────────────────────────────────────
  ['lime zest', 'lime zest'],

  // ── Lime (the fruit) ──────────────────────────────────────────────────────
  ['lime', 'lime'],
  ['lime wedges', 'lime'],
  ['limes', 'lime'],

  // ── Orange juice ──────────────────────────────────────────────────────────
  ['orange juice', 'orange juice'],
  ['fresh orange juice', 'orange juice'],

  // ── Honey (additional variants) ───────────────────────────────────────────
  ['raw honey', 'honey'],

  // ── Maple syrup (additional variants) ────────────────────────────────────
  ['pure maple syrup', 'maple syrup'],

  // ── Paprika (additional variants) ─────────────────────────────────────────
  ['sweet paprika', 'paprika'],

  // ── Smoked paprika (additional variants) ──────────────────────────────────
  ['spanish smoked paprika', 'smoked paprika'],

  // ── Cumin (additional variants) ───────────────────────────────────────────
  ['ground cumin', 'cumin'],

  // ── Coriander (additional variants) ───────────────────────────────────────
  ['coriander', 'coriander'],
  ['ground coriander', 'coriander'],

  // ── Cinnamon (additional variants) ────────────────────────────────────────
  ['cinnamon', 'cinnamon'],
  ['ground cinnamon', 'cinnamon'],

  // ── Turmeric (additional variants) ────────────────────────────────────────
  ['turmeric', 'turmeric'],
  ['turmeric powder', 'turmeric'],

  // ── Nutmeg ────────────────────────────────────────────────────────────────
  ['nutmeg', 'nutmeg'],
  ['ground nutmeg', 'nutmeg'],

  // ── Red pepper flakes (additional variants) ───────────────────────────────
  ['chili flakes', 'red pepper flakes'],

  // ── Bay leaf (additional variants) ────────────────────────────────────────
  ['bay leaves', 'bay leaf'],

  // ── Jasmine rice (additional variants) ────────────────────────────────────
  ['dry jasmine rice', 'jasmine rice'],

  // ── Basmati rice (additional variants) ────────────────────────────────────
  ['dry basmati rice', 'basmati rice'],

  // ── Brown rice (additional variants) ──────────────────────────────────────
  ['dry brown rice', 'brown rice'],

  // ── White bean ────────────────────────────────────────────────────────────
  ['white bean', 'white bean'],
  ['white beans', 'white bean'],
  ['white beans - drained', 'white bean'],
  ['can cannellini beans', 'white bean'],

  // ── Black bean ────────────────────────────────────────────────────────────
  ['black bean', 'black bean'],
  ['black beans', 'black bean'],
  ['can black beans', 'black bean'],

  // ── Chickpea ──────────────────────────────────────────────────────────────
  ['chickpea', 'chickpea'],
  ['chickpeas', 'chickpea'],
  ['cans chickpeas', 'chickpea'],

  // ── Chipotle in adobo ─────────────────────────────────────────────────────
  ['chipotle pepper in adobo', 'chipotle pepper in adobo'],
  ['chipotle peppers in adobo sauce', 'chipotle pepper in adobo'],
  ['1–2 chipotle peppers in adobo sauce', 'chipotle pepper in adobo'],

  // ── Vegetable broth (additional variants) ─────────────────────────────────
  ['vegetable stock', 'vegetable broth'],

  // ── Orange (fruit variants) ────────────────────────────────────────────────
  ['navel orange', 'orange'],
  ['navel oranges', 'orange'],

  // ── Orange zest ───────────────────────────────────────────────────────────
  ['orange zest', 'orange zest'],

  // ── Oats (additional variants) ────────────────────────────────────────────
  ['old-fashioned rolled oats', 'rolled oats'],
  ['old fashioned rolled oats', 'rolled oats'],

  // ── Kidney beans (additional variants) ────────────────────────────────────
  ['red kidney beans', 'kidney beans'],
  ['cans red kidney beans', 'kidney beans'],

  // ── Truffle oil ───────────────────────────────────────────────────────────
  ['truffle oil', 'truffle oil'],

  // ── Vanilla bean paste ────────────────────────────────────────────────────
  ['vanilla bean paste', 'vanilla bean paste'],

  // ── Almond milk (additional variants) ────────────────────────────────────
  ['almond milk', 'almond milk'],
  ['unsweetened almond milk', 'almond milk'],
  ['vanilla almond milk', 'almond milk'],
  ['unsweetened vanilla almond milk', 'almond milk'],

  // ── Pistachios ────────────────────────────────────────────────────────────
  ['pistachio', 'pistachios'],
  ['pistachios', 'pistachios'],
  ['shelled pistachios', 'pistachios'],

  // ── Hemp seeds ────────────────────────────────────────────────────────────
  ['hemp seeds', 'hemp seeds'],
  ['hemp seed', 'hemp seeds'],

  // ── Yukon potato ──────────────────────────────────────────────────────────
  ['yukon potato', 'yukon potatoes'],
  ['yukon potatoes', 'yukon potatoes'],
  ['yukon gold potato', 'yukon potatoes'],
  ['yukon gold potatoes', 'yukon potatoes'],

  // ── Parsnip (plural) ──────────────────────────────────────────────────────
  ['parsnips', 'parsnip'],

  // ── Beet (color variants) ─────────────────────────────────────────────────
  ['red beet', 'beet'],
  ['red beets', 'beet'],
  ['golden beet', 'beet'],
  ['golden beets', 'beet'],

  // ── Avocado (plural) ──────────────────────────────────────────────────────
  ['avocados', 'avocado'],

  // ── Salmon (additional variants) ──────────────────────────────────────────
  ['salmon fillet', 'salmon'],
  ['salmon fillets', 'salmon'],
  ['skinless salmon fillet', 'salmon'],

  // ── Strip steak ───────────────────────────────────────────────────────────
  ['strip steak', 'strip steak'],
  ['new york strip', 'strip steak'],
  ['ny strip', 'strip steak'],

  // ── Cocoa powder (asterisk/variant handling) ──────────────────────────────
  ['cocoa powder*', 'cocoa powder'],
  ['unsweetened cocoa powder', 'cocoa powder'],

  // ── 5 grain / multigrain ──────────────────────────────────────────────────
  ['5 grain', '5 grain'],
  ['dry 5 grain', '5 grain'],
  ['5-grain', '5 grain'],
  ['five grain', '5 grain'],
  ['dry five grain', '5 grain'],

  // ── Water ─────────────────────────────────────────────────────────────────
  ['water', 'water'],
  ['filtered water', 'water'],
  ['filtered water (plus more as needed)', 'water'],
  ['filtered water (plus more as needed for consistency)', 'water'],
  ['cold water', 'water'],
  ['warm water', 'water'],
]);

