# Kokofibo — Kalkulator Finansial

A dependency-free financial calculator in Bahasa Indonesia. It covers future value, present value, loan payments, and savings goals, with live results, projection charts, a yearly amortization schedule, and light/dark themes.

The original standard calculator remains available at `standard.html`.

## Run it

Open `index.html` directly in a browser. No build step or installation is required.

For an optional local server:

```powershell
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Financial tools

- **Nilai masa depan** — project an initial balance plus monthly contributions with monthly, quarterly, or annual compounding.
- **Nilai sekarang** — calculate the lump sum needed today to reach a future target.
- **Cicilan pinjaman** — calculate a fixed monthly payment, total interest, payment composition, and yearly amortization schedule.
- **Target dana** — calculate the monthly saving required to reach a goal, including current savings and investment growth.

All amounts are displayed in Indonesian Rupiah (`id-ID`). Results update automatically as assumptions change. The current tool is kept in the URL hash and the theme is saved in `localStorage`.

## Standard calculator

`standard.html` includes:

- Chained calculations with operator precedence and live previews
- Context-aware percentages (`200 + 10%` equals `220`)
- Keyboard controls and saved calculation history
- Responsive layout and light/dark themes

## Tests

Both calculation engines are browser-independent, so their tests run directly with Node:

```powershell
npm test
```

The suite covers arithmetic, formatting, history behavior, compound interest, present value, loan amortization, goal savings, compounding frequencies, and input validation.
