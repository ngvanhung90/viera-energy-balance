const ingredient = (name, grams, kcalPer100, aisle) => ({ name, grams, kcalPer100, aisle });

export const recipes = [
  {
    id: 'lemongrass', name: 'Lemongrass chicken bowl', cuisine: 'Asian', origin: 'Vietnamese',
    description: 'Sizzling lemongrass chicken, jasmine rice, crisp cucumber and fresh herbs.',
    minutes: 25, tastes: ['Herby', 'Savory'], vegetarian: false, video: 'Sw_FsOnLuCg', creator: 'Marion’s Kitchen',
    ingredients: [
      ingredient('Chicken breast, raw', 145, 120, 'Meat & seafood'),
      ingredient('Jasmine rice, cooked', 145, 130, 'Pantry'),
      ingredient('Cucumber', 65, 15, 'Fresh produce'), ingredient('Carrot', 45, 41, 'Fresh produce'),
      ingredient('Neutral oil', 10, 884, 'Pantry'), ingredient('Lemongrass', 12, 99, 'Fresh produce'),
      ingredient('Lime, mint and garlic', 18, 45, 'Fresh produce'),
      ingredient('Fish sauce', 10, 35, 'Pantry')
    ],
    steps: [
      ['Prep the bowl', 'Slice the cucumber and carrot. Chop the lemongrass and garlic. Set the vegetables and herbs aside.'],
      ['Season the chicken', 'Slice chicken on a separate board. Toss with lemongrass, garlic, fish sauce, lime and half the oil.'],
      ['Sear and check', 'Heat the remaining oil in a skillet. Cook the chicken in one layer, turning as it browns. Check the thickest pieces reach 74°C / 165°F.'],
      ['Assemble', 'Spoon warm rice into the bowl. Add the chicken, raw vegetables and herbs. Finish with fresh lime.']
    ]
  },
  {
    id: 'pasta', name: 'Roasted tomato & basil penne', cuisine: 'European', origin: 'Italian-inspired',
    description: 'Sweet roasted tomatoes, whole-wheat pasta and torn basil.',
    minutes: 30, tastes: ['Cozy', 'Herby'], vegetarian: true, video: 'qCYZ6bJgwzs', creator: 'Roasted Cherry Tomato Pasta',
    ingredients: [
      ingredient('Whole-wheat penne, dry', 80, 348, 'Pantry'), ingredient('Cherry tomatoes', 180, 18, 'Fresh produce'),
      ingredient('Olive oil', 12, 884, 'Pantry'), ingredient('Vegetarian hard cheese', 18, 392, 'Chilled'),
      ingredient('Basil and garlic', 15, 45, 'Fresh produce')
    ],
    steps: [
      ['Roast the tomatoes', 'Heat the oven to 220°C / 425°F. Toss tomatoes and garlic in oil and roast until the tomatoes burst.'],
      ['Boil the pasta', 'Cook penne in salted water according to its label. Save a small cup of cooking water before draining.'],
      ['Toss and serve', 'Lightly crush the tomatoes, add the pasta and stir in splashes of pasta water until glossy. Finish with basil and grated cheese.']
    ]
  },
  {
    id: 'soba', name: 'Crispy tofu soba', cuisine: 'Asian', origin: 'Japanese-inspired',
    description: 'Golden tofu, springy buckwheat noodles and green edamame.',
    minutes: 20, tastes: ['Savory', 'Crunchy'], vegetarian: true, video: 'gz9vQRj11S0', creator: 'Sticky Soy Tofu Soba Noodles',
    ingredients: [
      ingredient('Soba noodles, dry', 60, 336, 'Pantry'), ingredient('Firm tofu', 110, 144, 'Chilled'),
      ingredient('Shelled edamame', 55, 121, 'Chilled'), ingredient('Sesame oil', 7, 884, 'Pantry'),
      ingredient('Soy sauce', 10, 53, 'Pantry'), ingredient('Scallions and lime', 20, 28, 'Fresh produce')
    ],
    steps: [
      ['Cook the noodles and beans', 'Boil soba and edamame according to their labels. Drain the soba and rinse briefly in cool water.'],
      ['Crisp the tofu', 'Pat the tofu dry, cut it into cubes and sear in oil, turning after each side is golden.'],
      ['Dress the bowl', 'Mix soy sauce, lime and any remaining sesame oil. Toss with noodles and edamame, then top with tofu and scallions.']
    ]
  },
  {
    id: 'salmon', name: 'Lemon salmon & potatoes', cuisine: 'European', origin: 'Mediterranean-inspired',
    description: 'Lemon-roasted salmon with baby potatoes and wilted greens.',
    minutes: 35, tastes: ['Herby', 'Cozy'], vegetarian: false, video: '1ooEYowKmG0', creator: 'One Pan Salmon and Potatoes',
    ingredients: [
      ingredient('Atlantic salmon, raw', 140, 208, 'Meat & seafood'),
      ingredient('Baby potatoes', 150, 77, 'Fresh produce'),
      ingredient('Spinach', 75, 23, 'Fresh produce'), ingredient('Olive oil', 9, 884, 'Pantry'),
      ingredient('Lemon and parsley', 30, 29, 'Fresh produce')
    ],
    steps: [
      ['Start with potatoes', 'Halve the potatoes, toss with half the oil and roast at 220°C / 425°F until nearly tender.'],
      ['Add the salmon', 'Rub salmon with the remaining oil, lemon and parsley. Roast on the same tray until its thickest part reaches 63°C / 145°F.'],
      ['Wilt the greens', 'Wilt spinach with a splash of water. Plate with salmon, potatoes and a squeeze of lemon.']
    ]
  },
  {
    id: 'rolls', name: 'Shrimp & herb rice paper rolls', cuisine: 'Asian', origin: 'Vietnamese',
    description: 'Cool rice paper rolls with cooked shrimp, herbs and a lime dip.',
    minutes: 15, tastes: ['Crunchy', 'Herby'], vegetarian: false, video: 'HJPRPEJY2WM', creator: 'Natasha’s Kitchen',
    ingredients: [
      ingredient('Rice paper, dry', 32, 345, 'Pantry'), ingredient('Ready-to-eat cooked shrimp', 110, 99, 'Meat & seafood'),
      ingredient('Cooked rice vermicelli, chilled', 85, 109, 'Chilled'),
      ingredient('Cucumber and carrot', 95, 25, 'Fresh produce'),
      ingredient('Lettuce and fresh herbs', 35, 19, 'Fresh produce'),
      ingredient('Lime and fish sauce', 22, 32, 'Pantry')
    ],
    steps: [
      ['Lay out the filling', 'Cut vegetables into thin sticks. Pat the chilled cooked shrimp dry and set out the noodles, lettuce and herbs.'],
      ['Soften and roll', 'Dip one wrapper briefly in cool water. Lay it on a damp board, add filling near the bottom, fold the sides and roll snugly.'],
      ['Mix the dip', 'Stir lime juice and fish sauce with a splash of cool water. Serve the rolls immediately with the dip.']
    ]
  },
  {
    id: 'chickpea', name: 'Chickpea, pepper & yogurt bowl', cuisine: 'European', origin: 'Mediterranean-inspired',
    description: 'Roasted pepper, warm chickpeas and a cool lemon-yogurt dressing.',
    minutes: 25, tastes: ['Cozy', 'Crunchy'], vegetarian: true, video: 'Q0UiE9rS2tg', creator: 'Crispy Roasted Chickpea Yogurt Meze',
    ingredients: [
      ingredient('Cooked chickpeas, drained', 120, 164, 'Pantry'),
      ingredient('Bell pepper', 100, 31, 'Fresh produce'), ingredient('Cooked bulgur', 110, 83, 'Pantry'),
      ingredient('Plain Greek yogurt', 70, 73, 'Chilled'), ingredient('Olive oil', 11, 884, 'Pantry'),
      ingredient('Lemon and parsley', 25, 29, 'Fresh produce')
    ],
    steps: [
      ['Roast the chickpeas and pepper', 'Dry the chickpeas. Toss with sliced pepper and oil, then roast at 220°C / 425°F until the peppers soften.'],
      ['Mix the dressing', 'Stir lemon juice and chopped parsley into plain yogurt.'],
      ['Build the bowl', 'Spoon bulgur into the bowl, pile the warm chickpeas and peppers on top, then add the dressing.']
    ]
  }
];

// USDA FoodData Central SR Legacy, nutrient 1008 (kcal per 100 g).
const grain = (name, grams, kcal, aisle = 'Pantry') => ingredient(name, grams, kcal, aisle);
const produce = (name, grams, kcal) => ingredient(name, grams, kcal, 'Fresh produce');
const oliveOil = grams => grain('Olive oil', grams, 884);
const rice = grams => grain('Long-grain rice, cooked', grams, 130);
const egg = grams => grain('Hard-boiled egg', grams, 155, 'Chilled');
const tofu = grams => grain('Firm tofu', grams, 144, 'Chilled');
const lemon = grams => produce('Lemon juice', grams, 22);
const cucumber = grams => produce('Cucumber', grams, 15);

recipes.push(
  { id: 'edamame-rice', name: 'Edamame and cucumber rice bowl', cuisine: 'Asian', origin: 'Japanese-inspired',
    description: 'Warm rice and edamame with crisp cucumber and soy sauce.', minutes: 15, tastes: ['Savory', 'Crunchy'], vegetarian: true,
    fdc: [169757, 168411, 168409, 174277],
    ingredients: [rice(160), grain('Shelled edamame, prepared', 140, 121, 'Chilled'), cucumber(80), grain('Soy sauce', 12, 53)],
    steps: [['Warm the grains and beans', 'Prepare the edamame according to the package. Use freshly cooked rice.'],
      ['Assemble the bowl', 'Slice cucumber. Add rice and edamame, then finish with soy sauce.']] },
  { id: 'tofu-quinoa', name: 'Soy-glazed tofu and quinoa', cuisine: 'Asian', origin: 'Asian-inspired',
    description: 'Pan-seared tofu, quinoa and spinach.', minutes: 20, tastes: ['Savory', 'Cozy'], vegetarian: true,
    fdc: [172475, 168917, 168462, 171413, 174277],
    ingredients: [tofu(145), grain('Quinoa, cooked', 150, 120), produce('Spinach', 70, 23), oliveOil(8), grain('Soy sauce', 12, 53)],
    steps: [['Sear the tofu', 'Pat the tofu dry, cut into cubes and brown in the oil.'],
      ['Fold in greens', 'Wilt spinach in the pan. Add soy sauce and serve over warm cooked quinoa.']] },
  { id: 'egg-rice', name: 'Egg, avocado and rice bowl', cuisine: 'Asian', origin: 'Asian-inspired',
    description: 'Rice, hard-boiled egg, sliced avocado and a splash of soy sauce.', minutes: 18, tastes: ['Savory', 'Cozy'], vegetarian: true,
    fdc: [169757, 173424, 171705, 174277],
    ingredients: [rice(150), egg(100), produce('Avocado', 75, 160), grain('Soy sauce', 10, 53)],
    steps: [['Prepare rice and eggs', 'Start with hot cooked rice. Cook the eggs until both yolk and white are firm.'],
      ['Assemble', 'Peel and quarter the eggs. Add avocado slices and soy sauce to the bowl.']] },
  { id: 'lentil-salad', name: 'Warm lentil and tomato salad', cuisine: 'European', origin: 'Mediterranean-inspired',
    description: 'Lentils, ripe tomato, cucumber and lemon dressing.', minutes: 15, tastes: ['Herby', 'Crunchy'], vegetarian: true,
    fdc: [172421, 170457, 168409, 171413, 167747],
    ingredients: [grain('Lentils, cooked and drained', 235, 116), produce('Tomato', 120, 18), cucumber(75), oliveOil(12), lemon(15)],
    steps: [['Prepare the salad', 'Warm the drained lentils and dice the tomato and cucumber.'],
      ['Dress and serve', 'Whisk olive oil with lemon juice and toss with the salad.']] },
  { id: 'tuna-potatoes', name: 'Tuna, potato and spinach plate', cuisine: 'European', origin: 'Mediterranean-inspired',
    description: 'Tender potatoes, canned tuna, wilted spinach and lemon.', minutes: 25, tastes: ['Savory', 'Cozy'], vegetarian: false,
    fdc: [171986, 170440, 168462, 171413, 167747],
    ingredients: [grain('Canned light tuna in water, drained', 120, 116, 'Meat & seafood'), produce('Potatoes, boiled', 250, 86), produce('Spinach', 75, 23), oliveOil(10), lemon(15)],
    steps: [['Cook the potatoes', 'Peel and cube the potatoes. Boil until fork-tender, then drain.'],
      ['Assemble', 'Wilt spinach with a splash of water. Serve with potatoes, drained tuna, oil and lemon.']] },
  { id: 'yogurt-oats', name: 'Warm oats with yogurt', cuisine: 'European', origin: 'European-inspired',
    description: 'Warm whole oats finished with plain Greek yogurt.', minutes: 10, tastes: ['Cozy'], vegetarian: true,
    fdc: [173904, 170894],
    ingredients: [grain('Rolled oats, dry', 80, 379), grain('Plain nonfat Greek yogurt', 180, 59, 'Chilled')],
    steps: [['Simmer the oats', 'Cook the oats in water according to the package, stirring until soft.'],
      ['Finish the bowl', 'Take the oats off the heat and spoon the yogurt over them.']] }
);

export const workouts = [
  { id: 'stretch', name: 'Unwind & stretch', intensity: 'Gentle', minutes: 10, met: 2.3, style: 'Mobility', equipment: 'Chair', lowImpact: true, steps: [
    'Start with easy shoulder rolls and relaxed breathing.', 'Move through ankle circles and gentle hip hinges with a chair for support.',
    'Ease into light calf and chest stretches. Keep each stretch comfortable.'
  ] },
  { id: 'walk', name: 'Brisk neighborhood walk', intensity: 'Moderate', minutes: 20, met: 3.8, style: 'Walking', equipment: 'None', lowImpact: true, steps: [
    'Walk easily for 4 minutes to warm up.', 'Walk briskly for 12 minutes. You should still be able to talk.',
    'Slow down for the final 4 minutes.'
  ] },
  { id: 'cycle', name: 'Easy cycling loop', intensity: 'Moderate', minutes: 25, met: 4, style: 'Cycling', equipment: 'Bicycle', lowImpact: true, steps: [
    'Pedal at an easy pace for 5 minutes on a safe route or stationary bike.', 'Ride steadily for 15 minutes at a conversational pace.',
    'Pedal easily for the final 5 minutes.'
  ] },
  { id: 'jog', name: 'Easy jog for regular runners', intensity: 'Vigorous', minutes: 25, met: 7.5, style: 'Running', equipment: 'None', lowImpact: false, steps: [
    'Warm up with a 5-minute brisk walk.', 'Jog at a familiar pace for 15 minutes, walking whenever you need to.',
    'Cool down with a 5-minute walk.'
  ] },
  { id: 'yoga', name: 'Gentle standing yoga', intensity: 'Gentle', minutes: 10, met: 2.3, style: 'Yoga', equipment: 'None', lowImpact: true, steps: [
    'Stand comfortably with feet apart and breathe normally.',
    'Slowly raise and lower your arms. Add small side bends within a comfortable range.',
    'Return to a relaxed stance. Pause if you feel pain or dizziness.'
  ] },
  { id: 'strength', name: 'Chair-supported strength', intensity: 'Moderate', minutes: 15, met: 3, style: 'Strength', equipment: 'Chair', lowImpact: true, steps: [
    'Place a stable chair against a wall and warm up with easy arm and ankle movements.',
    'Alternate comfortable sit-to-stands and wall push-ups. Rest when you need to.',
    'Finish with an easy walk or seated rest.'
  ] },
  { id: 'cardio', name: 'Low-impact dance cardio', intensity: 'Moderate', minutes: 15, met: 4.8, style: 'Cardio', equipment: 'None', lowImpact: true, steps: [
    'Clear a small space and warm up with easy marching.',
    'Alternate side steps and gentle arm swings at a pace that lets you talk. Keep one foot on the floor.',
    'Slow down and finish with easy steps.'
  ] }
];

export const markets = [
  { name: 'Bến Thành Market', address: 'Bến Thành · Ho Chi Minh City', query: 'Bến Thành Market, Ho Chi Minh City', aisles: ['Fresh produce', 'Meat & seafood'] },
  { name: 'Co.opmart Cống Quỳnh', address: 'Cống Quỳnh · Ho Chi Minh City', query: 'Co.opmart Cống Quỳnh, Ho Chi Minh City', aisles: ['Fresh produce', 'Meat & seafood', 'Pantry', 'Chilled'] },
  { name: 'Annam Gourmet Hai Bà Trưng', address: 'Hai Bà Trưng · Ho Chi Minh City', query: 'Annam Gourmet Hai Bà Trưng, Ho Chi Minh City', aisles: ['Pantry', 'Chilled', 'Fresh produce'] }
];
