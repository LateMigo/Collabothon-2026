export const LESSONS = [
  {
    id: "budget",
    title: "Make a simple budget",
    points: [
      "A budget is a plan: money in, money that must go out, and what's left.",
      "A popular rule of thumb: about 50% for needs, 30% for wants, 20% for saving.",
      "Write down your spending for one month - most people are surprised where it goes.",
    ],
    example: "Income $2,000: rent and food $1,000, fun $600, savings $400.",
    inGame: "Rent is your 'needs' line. Keep it covered before you invest.",
    realLife: "A banking app that sorts your spending into categories makes this almost automatic.",
    check: {
      q: "In the 50/30/20 rule, what is the 20% for?",
      options: ["Saving", "Holidays", "Rent"],
      correct: 0,
    },
  },
  {
    id: "emergency",
    title: "Build an emergency fund",
    points: [
      "An emergency fund is money for surprises: a broken phone, a dentist bill, a lost job.",
      "A common goal is 3-6 months of essential costs.",
      "Keep it safe and easy to reach - in a savings account, not in shares.",
    ],
    example: "Essentials cost $1,000 a month, so the goal is $3,000-$6,000. Start with $500.",
    inGame: "Surprise bills in the game are paid from cash and savings first - otherwise shares get sold in a hurry.",
    realLife: "Open a separate savings account just for emergencies so you don't spend it by accident.",
    check: {
      q: "Where should an emergency fund be kept?",
      options: ["In one exciting share", "Somewhere safe and easy to reach, like savings", "Under the mattress"],
      correct: 1,
    },
  },
  {
    id: "interest",
    title: "Interest and compound interest",
    points: [
      "Interest is the price of money: you earn it when you save, you pay it when you borrow.",
      "Compound interest means you also earn interest on interest you already got.",
      "Time is the secret ingredient: the earlier you start, the more it grows.",
    ],
    example: "$1,000 at 5% a year: $1,050 after one year, $1,102.50 after two.",
    inGame: "Your savings account pays interest every week - and the interest grows with the balance.",
    realLife: "Compare savings rates, and look at the yearly rate (APR/APY) when you borrow.",
    check: {
      q: "What makes compound interest grow faster?",
      options: ["Taking the interest out every month", "Leaving the money for a long time", "Opening many accounts"],
      correct: 1,
    },
  },
  {
    id: "accounts",
    title: "Current account vs. savings account",
    points: [
      "A current account is for everyday money: salary in, card payments and bills out.",
      "A savings account is for money you put aside; it usually pays more interest.",
      "Many people move a fixed amount from current to savings on payday.",
    ],
    example: "Salary arrives on the 1st; a standing order moves $200 to savings on the 2nd.",
    inGame: "Cash is your current account; Commerzbank Savings is your savings account.",
    realLife: "Set up a standing order once - then saving happens without willpower.",
    check: {
      q: "Which account is best for money you won't need this month?",
      options: ["Savings account", "Current account", "Neither"],
      correct: 0,
    },
  },
  {
    id: "shares",
    title: "Shares, risk and reward",
    points: [
      "A share is a small piece of a company. Its price goes up and down with news and results.",
      "Shares can earn more than savings over many years - but they can also fall, even to zero.",
      "Only invest money you won't need soon, so you never have to sell at a bad moment.",
    ],
    example: "Buy at $20, the price drops to $15: it's a paper loss until you sell.",
    inGame: "Watch the bankruptcy risk gauge - at 100% a company's shares are worth $0.",
    realLife: "Start small and learn how prices move before investing larger amounts.",
    check: {
      q: "When is it safest to invest money in shares?",
      options: ["When you need it next week for rent", "When you won't need it for years", "When a friend says so"],
      correct: 1,
    },
  },
  {
    id: "diversify",
    title: "Don't put all your eggs in one basket",
    points: [
      "Diversification means spreading money over different investments.",
      "If one company has a bad week, the others can balance it out.",
      "Funds make it easy: one purchase holds pieces of many companies.",
    ],
    example: "$1,000 over 5 companies: one bankruptcy costs $200, not $1,000.",
    inGame: "Players who put everything in one company usually get the toughest inspector stamp.",
    realLife: "A monthly fund savings plan spreads small amounts over many companies automatically.",
    check: {
      q: "What does diversification protect you from?",
      options: ["One company's bad news hurting all your money", "Ever losing money", "Paying taxes"],
      correct: 0,
    },
  },
  {
    id: "bonds",
    title: "Bonds and term deposits",
    points: [
      "With a term deposit or a bond you lend money for a fixed time at a fixed interest.",
      "You know in advance what you'll get - but the money is locked until the end.",
      "Higher interest usually means higher risk: a company bond can default.",
    ],
    example: "$1,000 for 4 weeks at 0.5% a week comes back as about $1,020.",
    inGame: "The bond desk has bank deposits, government bonds and riskier company bonds.",
    realLife: "Match the end date to your plans - don't lock money you'll need for bills.",
    check: {
      q: "Why does a risky company bond pay more interest?",
      options: ["To reward you for the risk it may not pay back", "Because it's a gift", "It doesn't"],
      correct: 0,
    },
  },
  {
    id: "debt",
    title: "Borrowing wisely",
    points: [
      "Borrowing lets you buy something now and pay later - plus interest.",
      "Expensive debt (like an unpaid credit card) grows quickly; pay it off first.",
      "Only borrow what fits your budget, and check the total cost, not just the monthly payment.",
    ],
    example: "$1,000 on a card at 20% a year costs about $200 in interest if you don't pay it back.",
    inGame: "Companies with big debts and little cash are the ones that go bankrupt.",
    realLife: "Ask your bank for the total cost of a loan before you sign anything.",
    check: {
      q: "Which debt should you usually pay off first?",
      options: ["The one with the highest interest rate", "The newest one", "The smallest one, always"],
      correct: 0,
    },
  },
];

const KEY = "fq.lessons.done";

export function readLessonsDone() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function markLessonDone(id) {
  try {
    const done = readLessonsDone();
    if (!done.includes(id)) done.push(id);
    window.localStorage.setItem(KEY, JSON.stringify(done));
    return done;
  } catch {
    return [];
  }
}
