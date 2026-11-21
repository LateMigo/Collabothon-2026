export const WEEK_QUIZ = {
  1: {
    q: "A news story says something will happen \"in two weeks\". When can it move a share price?",
    options: ["Only in the week the story is printed", "When it actually happens - possibly weeks later", "Never - news doesn't move prices"],
    correct: 1,
    why: "Markets react when the money actually changes. That delay is called market lag - old headlines still matter.",
  },
  2: {
    q: "Fabric of Keramzyt raised its dividend. Who gets the money?",
    options: ["Everyone who owns its shares on payout day", "Only people who buy shares after the news", "The company's workers"],
    correct: 0,
    why: "A dividend goes to the owners of the shares on the payout day - the more shares, the more cash.",
  },
  3: {
    q: "Your phone breaks and the repair costs $80 right now. Where is the best place to take the money from?",
    options: ["Sell some shares, whatever the price", "An emergency fund in your savings account", "Skip paying and hope it goes away"],
    correct: 1,
    why: "An emergency fund exists exactly for surprises - so you never have to sell investments at a bad moment.",
  },
  4: {
    q: "Fabric of Keramzyt was hit twice in one week. What protects you most from one company's bad news?",
    options: ["Putting all your money into the cheapest share", "Spreading your money over several companies", "Checking the price every hour"],
    correct: 1,
    why: "Diversification: when your money is spread out, one bad headline can only hurt one small part of it.",
  },
  5: {
    q: "A company has just joined the exchange. What is true?",
    options: ["It has little history, so its price can swing a lot", "New companies can never lose money", "Its price is fixed for a year"],
    correct: 0,
    why: "With no track record, investors are guessing more - so the price of a new company often moves sharply.",
  },
  6: {
    q: "You know a $140 bill is coming in two weeks. What is the smartest move today?",
    options: ["Buy shares with all your cash and sell them later", "Set the $140 aside in savings now", "Wait and decide on the day"],
    correct: 1,
    why: "A bill you can see coming is easy to plan for. Parking it in savings means it's safe and even earns a little.",
  },
  7: {
    q: "Some headlines turned out to be \"noise\". What is noise?",
    options: ["A story that sounds big but changes nothing about a company's money", "Any bad news", "News that arrives at night"],
    correct: 0,
    why: "Ask: does this change the company's sales, costs, cash or debt? If not, it's probably noise.",
  },
  8: {
    q: "A bank cut a company's credit line. Why is that bad for its shares?",
    options: ["It isn't - less debt is always good", "Without new money it may not pay its bills, so its bankruptcy risk rises", "Banks only do it to famous companies"],
    correct: 1,
    why: "A company short of cash and unable to borrow may not pay suppliers or wages - investors get nervous.",
  },
  9: {
    q: "Interest rates went up. What happens to the money in your savings account?",
    options: ["It earns more interest", "It loses value", "Nothing ever changes in savings"],
    correct: 0,
    why: "When rates rise, banks pay more on savings - and borrowing becomes more expensive.",
  },
  10: {
    q: "Why is selling shares in a hurry to pay a bill a bad idea?",
    options: ["It isn't - shares are like cash", "You may have to sell at a low price and pay a selling fee", "Banks forbid it"],
    correct: 1,
    why: "Forced sellers can't wait for a better price. Keeping bill money in savings avoids that trap.",
  },
  11: {
    q: "A company bond pays more interest than a government bond. Why?",
    options: ["Because companies are always richer", "Because the company might not pay you back", "Because it's a mistake"],
    correct: 1,
    why: "Higher interest is the reward for higher risk. If the company goes bankrupt, you may get only part back.",
  },
  12: {
    q: "Which habit helps most with real money, starting this month?",
    options: ["Checking share prices every day", "An automatic transfer to savings on payday", "Keeping all money in cash at home"],
    correct: 1,
    why: "\"Pay yourself first\": money moves to savings before you can spend it - the easiest habit to keep.",
  },
};

const key = (sessionId) => `fq.quiz.${sessionId}`;

export function readQuizScore(sessionId) {
  try {
    return JSON.parse(window.localStorage.getItem(key(sessionId)) || "{}");
  } catch {
    return {};
  }
}

export function saveQuizAnswer(sessionId, week, correct) {
  try {
    const score = readQuizScore(sessionId);
    if (week in score) return score;
    score[week] = correct;
    window.localStorage.setItem(key(sessionId), JSON.stringify(score));
    return score;
  } catch {
    return {};
  }
}
