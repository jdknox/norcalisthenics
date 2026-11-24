# Add pantry items from ChatGPT

In ChatGPT, type an item, upload its barcode or nutrition label, or ask about a restaurant dish. ChatGPT returns one **Add to Protein Pantry** link. Open it in the browser you use for the protein site, review the prefilled pantry editor, and tap **Save**. The browser saves on that device and syncs to the Pi when it can reach it. Saving a pantry item does not log a serving.

## Link format

Use the existing protein site URL and put the draft in the fragment after `#`. The browser does not send this fragment to the Pi in the page request. The existing service worker can open the cached protein page at that same URL after the updated app has been loaded once in that browser on the LAN.

```text
https://protein.proovd.com/#pantry-add?v=1&name=Jasmine%20tea&serving_g=500&basis=serving&protein_g=0&kcal=0
```

| Field | Meaning |
| --- | --- |
| `v` | Required format version, initially `1`. |
| `name`, `brand` | Item name and optional brand or restaurant. A barcode can open a draft with a blank name if the product is unknown. |
| `barcode` | Optional digits as text, with leading zeros preserved. |
| `serving_g`, `volume_ml` | Optional serving mass in grams and volume in milliliters. Keep them separate. |
| `basis`, `protein_g`, `kcal` | Use `serving` or `100g` as the basis for any supplied nutrition values. Omit unknown values. Explicit zero remains zero. |
| `water_pct` | Optional water percentage by mass, from 0 to 100. |
| `estimate` | `1` when supplied nutrition or serving values are estimated. |

Generate percent-encoded values and keep the link short. Photos, reference URLs, and the reasoning behind estimates stay in the chat. The link itself contains the draft fields, so anyone who receives the link can read them.

## Chat instructions

Paste this prompt once into a dedicated ChatGPT chat:

```text
When I ask to add food to my Protein Pantry, prepare a draft using my text, photos, or a reliable lookup. Return a Markdown link labeled “Add to Protein Pantry” and a short review line with the serving size, nutrition basis, and any source or estimate.

Use https://protein.proovd.com/#pantry-add?v=1 followed by &key=value pairs. Percent-encode every value. Allowed fields are `name`, `brand` (or restaurant name), `barcode`, `serving_g`, `volume_ml`, `basis`, `protein_g`, `kcal`, `water_pct`, and `estimate`. Include at least `name` or `barcode`. Preserve leading zeros in `barcode`. If you include `protein_g` or `kcal`, set `basis=serving` or `basis=100g`. Omit unknown values and keep verified zeros as `0`. Use `serving_g` for grams and `volume_ml` for milliliters. Include `water_pct` for drinks only when you have a defensible estimate by mass.

For a barcode photo, use the printed digits and verify that a lookup matches them. Use details from photo to help find info.  Ask for a clearer photo or the digits if uncertain. Search for the exact digits in Open Food Facts or another reliable product source. A verified barcode without a product match can open a partial draft. Use a supplied nutrition label when available.

Example partial draft: `https://protein.proovd.com/#pantry-add?v=1&barcode=0835143001832&name=Bold%20Green%20Tea&brand=ITO%20EN&volume_ml=500`

For a restaurant dish, prefer published values for the exact dish and portion. Add estimate=1 if you estimate serving size or nutrition. State the assumed portion and the basis for the estimate in chat. Ask about ambiguous details or leave them blank. Leave photos and source URLs in chat.
```

If ChatGPT opens the link in a different browser profile, copy the whole URL into the address bar of the browser you normally use for the protein site.

## Site behavior

1. **Read a draft safely.** Recognize only the versioned `pantry-add` fragment. Parse a bounded set of fields with `URLSearchParams`. Check text lengths, reject duplicate parameters and unsupported versions, and validate numbers as complete finite decimal strings. Grams and mL must be positive when present. Nutrition must be non-negative. Populate the existing add-item draft through known properties and render it using the editor’s normal escaping.
2. **Open the existing editor.** Check the fragment once startup has loaded pantry data and on `hashchange` for links opened in the existing tab. Switch to Pantry, scroll to the editor, and show an estimate label where applicable. Preserve any other draft already being edited and let the user open the incoming draft when ready. Clear the fragment after Save or Cancel so a later refresh does not reopen it. A refresh before saving can reopen the original proposal.
3. **Check for duplicates before saving.** Reuse the pantry barcode lookup. If the barcode already exists locally, show the existing item and let the user open it. Without a barcode, flag an exact name and brand match for review. An item added on a different device while this browser is offline may first appear at sync, so simultaneous additions can still need review. Avoid silently combining distinct items.
4. **Save and sync through the existing pantry flow.** Use the regular pantry Save action and its pending-sync flag. Keep each linked addition in its own local record until the Pi acknowledges it. This allows two offline tabs to save against separate pantry snapshots without dropping a pending addition. While the app is closed, the addition stays in that browser and sync resumes when the site is opened again.

The first version uses the existing page, editor, service worker and Pi storage API. It needs no plugin, tunnel, or new server route.

## Release checks

- From ChatGPT on Android and desktop, open real links for typed data, a barcode with a leading zero, and an estimated restaurant item. Verify the link lands in the same browser profile that holds the pantry cache. Try the copy-and-open fallback as well.
- Verify `&`, `+`, accents, quoted names, a missing value and a real zero. Reject malformed, oversized or unsupported links without changing pantry data. Check an existing barcode and a link opened while another editor already contains unsaved work.
- On the LAN, load the updated site once. With the Pi unreachable and the browser tab closed, tap a link, save the draft, and refresh. Confirm the item survives locally and appears on the Pi once the site reconnects. Run the offline-cache and input regressions alongside this check.
