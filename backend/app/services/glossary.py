"""Offline answers for the glossary alien ("Berg") when Gemini is not available.

Each entry: the term, aliases the player might type, a plain explanation, an example with numbers and a few
related terms. Matching is a simple word search, so "what is a dividend?" finds "dividend".
"""

from __future__ import annotations

import re

GLOSSARY: list[dict] = [
    {
        "term": "Dividend",
        "aliases": ["dividend", "dividends", "payout"],
        "answer": "A dividend is a share of a company's profit that it pays in cash to everyone who owns its shares. "
        "The company decides how much and how often - and it can cut or stop the dividend when times are hard.",
        "example": "A company pays $0.50 per share every 4 weeks. With 20 shares you get $10 on each payout day.",
        "related": ["Share", "Profit margin", "Dividend yield"],
    },
    {
        "term": "Dividend yield",
        "aliases": ["dividend yield", "yield"],
        "answer": "Dividend yield compares the yearly dividend with the share price, as a percentage. "
        "It shows how much cash income you get for every $100 you invest in the share.",
        "example": "A $50 share that pays $2 a year has a 4% dividend yield: $4 for every $100 invested.",
        "related": ["Dividend", "Share price"],
    },
    {
        "term": "Share",
        "aliases": ["share", "shares", "stock", "stocks", "equity"],
        "answer": "A share is a small piece of ownership in a company. If the company does well, the share can rise in "
        "value and may pay dividends; if it does badly, the share can fall - even to zero.",
        "example": "A company is split into 1,000,000 shares. Owning 1,000 of them means you own 0.1% of it.",
        "related": ["Share price", "Dividend", "Diversification"],
    },
    {
        "term": "Share price",
        "aliases": ["share price", "stock price", "price"],
        "answer": "The share price is what one share costs right now. It moves as buyers and sellers react to news, "
        "results and expectations about the company's future.",
        "example": "You buy at $20 and the price rises to $23: each share gained $3 - on paper until you sell.",
        "related": ["Share", "Volatility"],
    },
    {
        "term": "Bond",
        "aliases": ["bond", "bonds", "government bond", "company bond", "corporate bond"],
        "answer": "A bond is a loan you give to a government or a company. They pay you a fixed interest and give your "
        "money back on a set date. Company bonds pay more because the company could fail to pay back.",
        "example": "You lend $1,000 for 8 weeks at 0.6% a week and get back about $1,048 at the end.",
        "related": ["Interest", "Default", "Term deposit"],
    },
    {
        "term": "Term deposit",
        "aliases": ["term deposit", "deposit", "time deposit", "fixed deposit"],
        "answer": "A term deposit is money you lock in a bank for a fixed time in exchange for a better interest rate "
        "than a normal savings account. Taking it out early usually costs you the interest.",
        "example": "A 4-week deposit at 0.5% a week turns $1,000 into about $1,020.",
        "related": ["Interest", "Savings account", "Bond"],
    },
    {
        "term": "Interest",
        "aliases": ["interest", "interest rate", "rate"],
        "answer": "Interest is the price of money. When you save or lend, you earn interest; when you borrow, you pay it. "
        "It is usually shown as a percentage per year (or, in this game, per week).",
        "example": "$1,000 at 0.3% a week earns $3 in the first week.",
        "related": ["Compound interest", "Savings account", "Loan"],
    },
    {
        "term": "Compound interest",
        "aliases": ["compound interest", "compounding", "compound"],
        "answer": "Compound interest means you also earn interest on the interest you already received. "
        "The longer you leave money untouched, the faster it grows.",
        "example": "$1,000 at 5% a year: $1,050 after one year, $1,102.50 after two - the extra $2.50 is interest on interest.",
        "related": ["Interest", "Savings account"],
    },
    {
        "term": "Savings account",
        "aliases": ["savings account", "savings", "saving"],
        "answer": "A savings account keeps your money safe at the bank and pays a small interest. You can usually take "
        "the money out at any time, which makes it a good place for an emergency fund.",
        "example": "Keeping next month's rent in savings means a bad week on the market can't stop you paying it.",
        "related": ["Emergency fund", "Interest", "Liquidity"],
    },
    {
        "term": "Emergency fund",
        "aliases": ["emergency fund", "buffer", "rainy day"],
        "answer": "An emergency fund is money set aside for surprises - a broken phone, a medical bill, losing a job. "
        "A common goal is 3 to 6 months of essential costs, kept somewhere safe and easy to reach.",
        "example": "If rent and food cost $1,000 a month, an emergency fund of $3,000-$6,000 is a solid target.",
        "related": ["Savings account", "Liquidity", "Budget"],
    },
    {
        "term": "Diversification",
        "aliases": ["diversification", "diversify", "diversified", "spread risk"],
        "answer": "Diversification means spreading your money across different investments, so one bad one can't "
        "sink you. It's the money version of not putting all your eggs in one basket.",
        "example": "$1,000 split over 5 companies: if one goes bankrupt you lose $200, not $1,000.",
        "related": ["Risk", "Portfolio"],
    },
    {
        "term": "Portfolio",
        "aliases": ["portfolio", "holdings"],
        "answer": "Your portfolio is everything you have invested: shares, bonds, deposits and savings together.",
        "example": "$500 in savings, $1,000 in bonds and $1,500 in shares make a $3,000 portfolio.",
        "related": ["Diversification", "Net worth"],
    },
    {
        "term": "Risk",
        "aliases": ["risk", "risky", "volatility", "volatile"],
        "answer": "Risk is the chance that an investment ends up worth less than you hoped - or less than you paid. "
        "Higher possible returns almost always come with higher risk.",
        "example": "Savings barely move; shares can rise 30% or fall 30% in a year.",
        "related": ["Diversification", "Bankruptcy"],
    },
    {
        "term": "Bankruptcy",
        "aliases": ["bankruptcy", "bankrupt", "insolvent", "insolvency"],
        "answer": "Bankruptcy happens when a company can't pay its bills or debts. Its shares usually become worthless, "
        "and lenders get back only part of their money.",
        "example": "You hold $500 of shares in a company that goes bankrupt: they drop to $0.",
        "related": ["Debt", "Default", "Risk"],
    },
    {
        "term": "Default",
        "aliases": ["default", "defaulted"],
        "answer": "A default is when a borrower fails to pay back a loan or a bond as promised. "
        "Lenders then get back only part of their money, sometimes nothing.",
        "example": "You lent $500 through a company bond; the company goes bankrupt and you recover $150.",
        "related": ["Bond", "Bankruptcy"],
    },
    {
        "term": "Debt",
        "aliases": ["debt", "loan", "loans", "borrow", "borrowing", "credit"],
        "answer": "Debt is borrowed money that must be paid back, usually with interest. "
        "Some debt can help a company grow; too much can push it into bankruptcy.",
        "example": "A loan of $10,000 at 6% a year costs $600 in interest every year.",
        "related": ["Interest", "Bankruptcy"],
    },
    {
        "term": "Profit margin",
        "aliases": ["profit margin", "margin", "profit", "profitability"],
        "answer": "Profit margin shows how much of every $1 of sales a company keeps as profit after paying all costs.",
        "example": "Sales of $100 and costs of $88 leave $12 profit: a 12% margin.",
        "related": ["Dividend", "Cash flow"],
    },
    {
        "term": "Inflation",
        "aliases": ["inflation", "prices rising", "cost of living"],
        "answer": "Inflation means prices in general go up over time, so the same money buys less. "
        "Money that earns less than inflation slowly loses value.",
        "example": "With 5% inflation, a $100 shopping basket costs $105 a year later.",
        "related": ["Interest", "Savings account"],
    },
    {
        "term": "Liquidity",
        "aliases": ["liquidity", "liquid"],
        "answer": "Liquidity is how quickly you can turn something into cash without losing value. "
        "Cash and savings are very liquid; a locked deposit or a house is not.",
        "example": "Rent is due tomorrow: savings can pay it, an 8-week deposit can't.",
        "related": ["Savings account", "Emergency fund"],
    },
    {
        "term": "Spread",
        "aliases": ["spread", "fee", "fees", "commission", "selling fee"],
        "answer": "A spread or fee is the cost of making a trade - the difference between what you pay and what you "
        "get back. Trading often means paying it often.",
        "example": "With a 2% selling fee, $500 worth of shares brings you $490.",
        "related": ["Share price"],
    },
    {
        "term": "Net worth",
        "aliases": ["net worth", "wealth", "assets"],
        "answer": "Net worth is everything you own minus everything you owe.",
        "example": "$3,000 in savings and investments minus a $500 loan = $2,500 net worth.",
        "related": ["Portfolio", "Debt"],
    },
    {
        "term": "Budget",
        "aliases": ["budget", "budgeting", "spending plan"],
        "answer": "A budget is a simple plan for your money: what comes in, what must go out, and what's left to save "
        "or invest.",
        "example": "Income $2,000: rent $800, food $400, other $400, savings $400.",
        "related": ["Emergency fund", "Savings account"],
    },
    {
        "term": "ETF",
        "aliases": ["etf", "index fund", "fund", "funds"],
        "answer": "A fund (for example an index fund or ETF) pools money from many people and buys many investments "
        "at once - an easy way to diversify with one purchase.",
        "example": "One fund share can hold small pieces of hundreds of companies.",
        "related": ["Diversification", "Share"],
    },
]

TOPICS = ", ".join(entry["term"].lower() for entry in GLOSSARY[:12])


def find_entry(question: str) -> dict | None:
    """Best match for the question: the longest alias that appears in it as whole words."""
    text = " " + re.sub(r"[^a-z0-9 ]+", " ", question.lower()) + " "
    best: tuple[int, dict] | None = None
    for entry in GLOSSARY:
        for alias in entry["aliases"]:
            if f" {alias} " in text and (best is None or len(alias) > best[0]):
                best = (len(alias), entry)
    return best[1] if best else None
