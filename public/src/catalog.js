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

export const workouts = [
  { id: 'stretch', name: 'Unwind & stretch', intensity: 'Gentle', minutes: 10, met: 2.3, style: 'Mobility', steps: [
    'Start with easy shoulder rolls and relaxed breathing.', 'Move through ankle circles and gentle hip hinges with a chair for support.',
    'Ease into light calf and chest stretches. Keep each stretch comfortable.'
  ] },
  { id: 'walk', name: 'Brisk neighborhood walk', intensity: 'Moderate', minutes: 20, met: 3.8, style: 'Walking', steps: [
    'Walk easily for 4 minutes to warm up.', 'Walk briskly for 12 minutes. You should still be able to talk.',
    'Slow down for the final 4 minutes.'
  ] },
  { id: 'cycle', name: 'Easy cycling loop', intensity: 'Moderate', minutes: 25, met: 4, style: 'Cycling', steps: [
    'Pedal at an easy pace for 5 minutes on a safe route or stationary bike.', 'Ride steadily for 15 minutes at a conversational pace.',
    'Pedal easily for the final 5 minutes.'
  ] },
  { id: 'jog', name: 'Easy jog for regular runners', intensity: 'Vigorous', minutes: 25, met: 7.5, style: 'Running', steps: [
    'Warm up with a 5-minute brisk walk.', 'Jog at a familiar pace for 15 minutes, walking whenever you need to.',
    'Cool down with a 5-minute walk.'
  ] }
];

export const markets = [
  { name: 'Bến Thành Market', address: 'Bến Thành · Ho Chi Minh City', query: 'Bến Thành Market, Ho Chi Minh City', aisles: ['Fresh produce', 'Meat & seafood'] },
  { name: 'Co.opmart Cống Quỳnh', address: 'Cống Quỳnh · Ho Chi Minh City', query: 'Co.opmart Cống Quỳnh, Ho Chi Minh City', aisles: ['Fresh produce', 'Meat & seafood', 'Pantry', 'Chilled'] },
  { name: 'Annam Gourmet Hai Bà Trưng', address: 'Hai Bà Trưng · Ho Chi Minh City', query: 'Annam Gourmet Hai Bà Trưng, Ho Chi Minh City', aisles: ['Pantry', 'Chilled', 'Fresh produce'] }
];
