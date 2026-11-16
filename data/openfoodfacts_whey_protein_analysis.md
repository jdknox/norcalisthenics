# Whey protein export analysis

Source: `data/openfoodfacts_whey_protein_export.csv` (tab-separated despite its .csv extension). All 50 source rows are retained in their original order.

Protein density is calculable for 27 products; protein per actual serving for 22; protein per package for 4. The remaining 23 products lack protein nutrition values.

- Protein ratio (g/g) = protein grams per serving / serving mass in grams.
- Protein percentage by mass = ratio × 100. This also equals protein grams per 100 g of product.
- Protein per package = ratio × net package mass in grams.
- When only per-100-g nutrition exists, ratio = reported protein per 100 g / 100; protein per serving is derived only if serving mass is known.
- Package conversion: 1 oz = 28.349523125 g; 1 lb = 453.59237 g; 1 kg = 1,000 g. Ounces here are weight ounces.
- Calculations use unrounded values; displayed report values are rounded to two decimals. CSV ratios retain eight decimal places and other calculations up to six. Package totals are estimates based on the recorded nutrition and net weight.
- A serving described as a packet is not assumed to equal the full package when package quantity is missing. Missing values are shown as — and remain blank in the CSV.

## Products with calculable package protein

| Product / brand | Code | Package | Protein / serving | Protein % | Protein / package (g) |
|---|---|---:|---:|---:|---:|
| Whey+ Unflavored / Legion | 0019962009358 | 792 g | 24 / 30 g | 80% | 633.6 |
| Unflavored Whey Isolate / 365 | 0099482532413 | 32 oz | 25 / 30 g | 83.33% | 755.99 |
| Impact Whey Protein Unflavored / MYPROTEIN | 5055534302910 | 2.5 kg | 23 / 30 g | 76.67% | 1916.67 |
| Whey Protein Unflavored / Rustic Nutrition | 0860011906766 | 24 oz | 19 / 25 g | 76% | 517.1 |

MYPROTEIN code 5055534302910: 23 g / 30 g gives 76.67% and 1,916.67 g protein per 2.5 kg package. Its separately reported 75 g protein per 100 g gives 75% and 1,875 g protein per package. Both are preserved in the CSV; the source does not resolve the difference.

## Every source product

“100 g basis” indicates density from per-100-g nutrition. For MYPROTEIN code 5059883569611, 22.5 g protein per 30 g serving is derived from that density. A missing serving mass is never replaced with an assumed scoop size.

| Code | Product | Brand | Serving (g) | Protein / serving (g) | Protein % | Protein / package (g) | Basis / missing data |
|---|---|---|---:|---:|---:|---:|---|
| 0700053396685 | Unflavored Whey Protein | Tim's Just Clean Protein | 35 | 32 | 91.43 | — | Serving data; package mass missing |
| 16587616 | Unflavored whey protein powder | — | — | — | 85.71 | — | 100 g basis; package mass missing; serving mass missing |
| 0815667021561 | Grass-fed Whey Protein Powder Unflavored | Puori | 30 | 24 | 80 | — | Serving data; package mass missing |
| 0023249093732 | Whey Protein Isolate Unflavored | Sports Research | 34 | 25 | 73.53 | — | Serving data; package mass missing |
| 5059883593074 | My protein Impact Whey Protein Unflavored | My protein | 30 | 22 | 73.33 | — | Serving data; package mass missing |
| 5059883569611 | Impact Whey Protein unflavored | MYPROTEIN | 30 | 22.5 | 75 | — | 100 g basis; package mass missing |
| 7792981063077 | TrueMade Whey Protein Unflavored | ENA | 31 | 25 | 80.65 | — | Serving data; package mass missing |
| 7290014386389 | Unflavored Whey Protein | Sommer Laboratories | 33 | 25 | 75.76 | — | Serving data; package mass missing |
| 0742488241932 | Unflavored Whey Protein | Promix | 31 | 25 | 80.65 | — | Serving data; package mass missing |
| 0019962009358 | Whey+ Unflavored | Legion | 30 | 24 | 80 | 633.6 | Serving data |
| 5060751999188 | Whey Protein | Optimum Nutrition Unflavored | — | — | 80 | — | 100 g basis; package mass missing; serving mass missing |
| 0048107252410 | Whey Protein Unflavored | GNC | 30.03 | 25 | 83.25 | — | Serving data; package mass missing |
| 5059883593135 | Unflavored Whey Protein | MYPROTEIN | 30 | 22 | 73.33 | — | Serving data; package mass missing |
| 0099482532413 | Unflavored Whey Isolate | 365 | 30 | 25 | 83.33 | 755.99 | Serving data |
| 5055534302910 | Impact Whey Protein Unflavored | MYPROTEIN | 30 | 23 | 76.67 | 1916.67 | Serving data; alternate package total 1,875 g (see above) |
| 0860011906766 | Whey Protein Unflavored | Rustic Nutrition | 25 | 19 | 76 | 517.1 | Serving data |
| 0850059419779 | Organic Whey Protein - Unflavored | Truvani | 26 | 20 | 76.92 | — | Serving data; package mass missing |
| 9339966004649 | Whey Protein Isolate Unflavored and Unsweetened | natural-road | 30 | 26.8 | 89.33 | — | Serving data; package mass missing |
| 0810180026031 | Whey Protein Isolate Unflavored | amazing-nutrition | 30 | 27 | 90 | — | Serving data; package mass missing |
| 0732388403202 | Hydrolyzed whey Protein - Unflavored | nutrabolics | 32 | 28 | 87.5 | — | Serving data; package mass missing |
| 0753215594283 | Unflavored & Unsweetened Whey Protein Isolate | canada-protein | 30 | 28 | 93.33 | — | Serving data; package mass missing |
| 0753215595907 | Whey Protein Concentrate Unflavored & Unsweetened | canadian-protein | 30 | 24 | 80 | — | Serving data; package mass missing |
| 0621375132174 | Whey Protein unflavored | — | — | — | 77.42 | — | 100 g basis; package mass missing; serving mass missing |
| 00191502 | Hydrolysed Whey Protein Isolate Unflavored | bulk | 30 | 26 | 86.67 | — | Serving data; package mass missing |
| 0733739021724 | Whey Protein Isolate Unflavored | now | 28 | 25 | 89.29 | — | Serving data; package mass missing |
| 00267807 | Bulk pure whey protein unflavored | — | — | — | 77 | — | 100 g basis; package mass missing; serving mass missing |
| 8595717722519 | 100% Whey Protein grass-fed Unflavored | vilgain | — | — | 78 | — | 100 g basis; package mass missing; serving mass missing |
| 7290119913411 | Whey protein unflavored | life-allin | 100 | — | — | — | Protein data missing; package mass missing |
| 0810028190344 | Whey Protein Isolate Cold-Pressed, Unflavored | true-nutrition | 34 | — | — | — | Protein data missing |
| 0850046940095 | Protein powder Whey Unflavored | gainful | 25 | — | — | — | Protein data missing; package mass missing |
| 5059883468440 | Impact Whey Protein, Unflavored | MYPROTEIN | 30 | — | — | — | Protein data missing; package mass missing |
| 8851788800922 | PLANT protein Unflavored | the-merry | 52.5 | — | — | — | Protein data missing; labeled plant protein |
| 9421901323066 | Whey Protein Unflavored | zealea | 30 | — | — | — | Protein data missing; package mass missing |
| 7340028813118 | Whey Protein Powder - Unflavored | smartsupps | — | — | — | — | Protein data missing; package mass missing; serving mass missing |
| 0814722021775 | Whey Protein Concentrate Unflavored | muscle-feast | 30 | — | — | — | Protein data missing; package mass missing |
| 0848054006377 | Unflavored Whey Protein | happy-day | 33 | — | — | — | Protein data missing; package mass missing |
| 8595717722533 | Whey Protein Unflavored | vilgain | 30 | — | — | — | Protein data missing; package mass missing |
| 5059883468433 | Impact Whey Protein Unflavored | MYPROTEIN | 30 | — | — | — | Protein data missing; package mass missing |
| 0742488241864 | Whey Protein Puffs (Unflavored) | promix | 13.6 | — | — | — | Protein data missing; package mass missing |
| 7290019310990 | Whey Protein Unflavored | allin | 33 | — | — | — | Protein data missing |
| 8906133020002 | Whey Protein Isolate Unflavored | nakpro | 34 | — | — | — | Protein data missing; package mass missing |
| 0860010318515 | Clear Whey Isolate Protein Powder Unflavored | wicked-protein | 28 | — | — | — | Protein data missing; package mass missing |
| 0814722020082 | 100% Whey Protein Powder - Unflavored | muscle-feast | 25 | — | — | — | Protein data missing |
| 3858891292724 | Whey Unflavored Protein | active-life | 32 | — | — | — | Protein data missing; package mass missing |
| 0815044020170 | Organic Whey Unflavored Protein | natural-force | — | — | — | — | Protein data missing; package mass missing; serving mass missing |
| 0729863020061 | Whey Protein Blend (unflavored) | ascent | 30 | — | — | — | Protein data missing; package mass missing |
| 0856215000065 | Unflavored whey protein | — | 30 | — | — | — | Protein data missing; package mass missing |
| 0811782030099 | Unflavored Whey Protein Isolate | — | — | — | — | — | Protein data missing; package mass missing; serving mass missing |
| 0099482500016 | Grass-Fed Whey Protein Isolate (Unflavored) | whole-foods | — | — | — | — | Protein data missing; package mass missing; serving mass missing |
| 0790011210399 | Jarrow formulas, 100% natural whey protein powder, unflavored, unflavored | — | 23 | — | — | — | Protein data missing; package mass missing |
