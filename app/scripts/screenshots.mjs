// Clicks through every page of the mock build and saves screenshots at desktop and
// phone widths, in light and dark. Run `npm run build:mock`, then `npx vite preview --mode mock`
// in another terminal, then `npm run screenshots`. Images land in ./screenshots.
// Set CHROMIUM_PATH to use a browser other than Playwright's own.

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:8000/'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const PAGES = [
  { name: '01-signin', scenario: 'signedout', path: '/signin', ready: 'text=Send me a sign-in link' },
  { name: '02-onboarding-about', scenario: 'new', path: '/onboarding', ready: 'text=First, a little about you' },
  { name: '03-onboarding-targets', scenario: 'new', path: '/onboarding', ready: 'text=First, a little about you', act: onboardingToTargets },
  { name: '04-today', scenario: 'full', path: '/', ready: "text=Today's questions" },
  { name: '05-question', scenario: 'full', path: '/questions/q1', ready: 'text=Submit for grading', act: (p) => p.getByLabel('Your answer').fill('First I would check whether the holdout still exists and is randomized...') },
  { name: '05b-question-graded', scenario: 'full', path: '/questions/q2', ready: '.monaco-editor', act: async (p) => { await p.click('role=tab[name=/Submissions/]'); await p.click('text=Model answer') } },
  { name: '05c-question-pending', scenario: 'full', path: '/questions/q3', ready: 'text=Submit for grading', act: submitAnswer },
  { name: '06-plan', scenario: 'full', path: '/plan', ready: 'text=Model evaluation and metrics' },
  { name: '07-targets', scenario: 'full', path: '/targets', ready: 'text=Research ready' },
  { name: '08-research', scenario: 'full', path: '/targets/t-whatnot', ready: 'text=The loop, round by round', act: (p) => p.getByRole('button', { name: /Recommender systems/ }).click() },
  { name: '09-research-pending', scenario: 'full', path: '/targets/t-databricks', ready: 'text=Not researched yet' },
  { name: '10-profile', scenario: 'full', path: '/profile', ready: 'text=Your details' },
  { name: '11-history', scenario: 'full', path: '/history', ready: 'text=Practice calendar' },
  { name: '11b-history-filtered', scenario: 'full', path: '/history', ready: 'text=Practice calendar', act: (p) => p.getByLabel('Result').selectOption('needs') },
  { name: '12-history-day', scenario: 'full', path: `/history/${daysAgo(3)}`, ready: 'text=answered ·' },
  { name: '13-question-from-history', scenario: 'full', path: '/questions/p20', ready: 'text=Why this question' },
  { name: '14-code-python-run', scenario: 'full', path: '/questions/q5', ready: '.monaco-editor', act: runCode },
  { name: '15-code-sql-testcase', scenario: 'full', path: '/questions/q2', ready: '.monaco-editor' },
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 860 } },
  { name: 'phone', viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true },
]

async function submitAnswer(page) {
  await page.getByLabel('Your answer').fill('Situation: our lead routing sent good leads to busy designers...')
  await page.click('text=Submit for grading')
  await page.waitForSelector('text=Waiting for a grade')
}

async function runCode(page) {
  await page.click('button:has-text("Run")')
  await page.waitForSelector('text=/examples passed/', { timeout: 60000 })
}

async function onboardingToTargets(page) {
  await page.getByLabel('Your name').fill('Sam')
  await page.getByLabel("Level you're aiming for").selectOption('Senior')
  await page.click('button:has-text("Continue")')
  await page.waitForSelector('text=Where are you aiming?')
  await page.getByLabel('Company').fill('Whatnot')
  await page.getByLabel('Role').fill('Machine Learning Engineer, Growth')
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
let failures = 0
for (const scheme of ['light', 'dark']) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ ...vp, colorScheme: scheme, deviceScaleFactor: 1 })
    for (const p of PAGES) {
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      try {
        await page.goto(`${BASE}?mock=${p.scenario}#${p.path}`)
        await page.waitForSelector(p.ready, { timeout: 8000 })
        if (p.act) await p.act(page)
        await page.waitForTimeout(150)
        await page.screenshot({ path: `${OUT}/${p.name}-${vp.name}-${scheme}.png`, fullPage: true })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
        if (overflow) errors.push('page scrolls horizontally')
      } catch (e) {
        errors.push(e.message.split('\n')[0])
      }
      if (errors.length) {
        failures++
        console.log(`✗ ${p.name} ${vp.name} ${scheme}: ${errors.join(' | ')}`)
      } else {
        console.log(`✓ ${p.name} ${vp.name} ${scheme}`)
      }
      await page.close()
    }
    await ctx.close()
  }
}
await browser.close()
process.exit(failures ? 1 : 0)
