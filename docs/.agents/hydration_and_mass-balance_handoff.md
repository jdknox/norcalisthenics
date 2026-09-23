Add a new tab to the existing protein logging website for **whole-body mass and hydration accounting**.

## Goal

Track body mass flow through the day with minimal manual input.

The system should estimate:

* water intake
* food mass intake
* total mass leaving the body
* current net mass balance
* body mass snapshots over time

This is **not** intended to estimate urine alone. "Mass out" means total inferred mass leaving the body, including:

* urine
* sweat
* respiratory water
* CO2 and other respiratory mass loss
* stool
* other minor losses

The accounting should therefore be described as **whole-body mass accounting**, with hydration as an important component.

## Core idea

Use body-weight measurements as checkpoints.

The user records all drinking water by known container volume.

The user weighs:

* after restroom use
* immediately before eating
* immediately after eating

The before/after meal pair lets the system estimate food mass without requiring food to be weighed separately.

## Event types

### Water

User taps a preset container volume when the container is finished.

Example:

```text
Water +750 mL
```

Treat water density as approximately:

```text
1 mL = 1 g
```

Therefore:

```text
750 mL water = 0.750 kg mass in
```

Support configurable container presets, for example:

```text
250 mL
500 mL
750 mL
1000 mL
```

The exact presets should be easy to change.

Each water event stores:

```text
timestamp
volume_ml
mass_kg
```

### Pre-meal weight

Record body mass immediately before eating.

Example:

```text
12:03
81.620 kg
```

This also acts as a body-mass checkpoint.

### Post-meal weight

Record body mass immediately after eating.

Pair it with the most recent unmatched pre-meal weight.

Calculate:

```text
food_mass_kg = post_meal_mass_kg - pre_meal_mass_kg
```

Example:

```text
pre meal:   81.620 kg
post meal:  82.170 kg

food mass = 0.550 kg
```

This is an estimate because some respiratory and evaporative mass is lost while eating, but that error is acceptable for this purpose.

Store the inferred food mass as a mass-in event.

### Post-restroom weight

Record body mass immediately after restroom use.

This is simply another body-mass checkpoint.

Do not attempt to label the resulting inferred loss as urine.

## Mass accounting

Between any two body-mass checkpoints:

```text
mass_out =
    previous_checkpoint_mass
    + mass_in_since_previous_checkpoint
    - current_checkpoint_mass
```

Where:

```text
mass_in_since_previous_checkpoint =
    water_mass
    + inferred_food_mass
```

Example:

```text
08:00 post-restroom mass     81.300 kg
09:00 water                  +0.500 kg
12:00 pre-meal mass           81.620 kg
```

Then:

```text
mass_out =
    81.300
    + 0.500
    - 81.620

mass_out = 0.180 kg
```

After eating:

```text
12:00 pre-meal              81.620 kg
12:20 post-meal             82.170 kg
```

Then:

```text
food_mass = 0.550 kg
```

Later:

```text
14:30 water                  +0.500 kg
16:00 post-restroom          82.200 kg
```

Then:

```text
mass_out =
    82.170
    + 0.500
    - 82.200

mass_out = 0.470 kg
```

## Important model distinction

Do not present:

```text
mass_out
```

as:

```text
urine volume
```

It represents all inferred body mass leaving the system between measurements.

Likewise, do not present:

```text
water_in - mass_out
```

as literal body-water change.

Food contains water and dry mass, and respiratory mass loss includes CO2.

The system is a mass-flow model with hydration tracking, not a clinical fluid-balance measurement.

## Recommended UI

Add a new top-level tab such as:

```text
Hydration
```

or:

```text
Mass Balance
```

Prefer `Mass Balance` if only one label is used because that better describes the actual calculation.

The primary mobile-friendly actions should be very fast:

```text
+ Water
Pre Meal
Post Meal
Post Restroom
```

### Water action

One tap should record the user's default water container.

Also allow selecting another preset volume.

Example primary button:

```text
+750 mL
```

### Weight actions

Each weight action should open a simple numeric entry field.

Example:

```text
81.35 kg
```

Default or prefill intelligently from the most recent body mass so that usually only the last few digits need changing.

## Current-day display

Show at least:

```text
Water in
Food mass in
Total mass in
Inferred mass out
Latest body mass
Net mass balance
```

Definitions:

```text
total_mass_in =
    water_mass_in
    + food_mass_in
```

For a selected period:

```text
net_mass_balance =
    total_mass_in
    - inferred_mass_out
```

This should reconcile approximately with change in measured body mass between the first and latest checkpoints.

## Event log

Display events chronologically.

Example:

```text
08:00  Post restroom     81.300 kg
09:00  Water             +500 mL
12:00  Pre meal          81.620 kg
12:20  Post meal         82.170 kg   Food +550 g
14:30  Water             +500 mL
16:00  Post restroom     82.200 kg   Mass out 470 g
```

For each checkpoint after the first, optionally show the inferred mass loss since the prior checkpoint.

## Data model

A simple event model is preferred.

Something conceptually similar to:

```text
event_id
timestamp
event_type
body_mass_kg
water_volume_ml
mass_in_kg
related_event_id
```

Possible `event_type` values:

```text
water
pre_meal_weight
post_meal_weight
post_restroom_weight
```

Avoid duplicating derived values unnecessarily if they can be recomputed reliably from the event ledger.

## Meal pairing

A `post_meal_weight` should pair with the most recent unmatched `pre_meal_weight`.

If no valid pre-meal measurement exists, do not fabricate food mass.

Show the measurement as unpaired and allow the user to correct or delete it.

Do not pair meals across obviously invalid ordering or long unrelated gaps.

## Editing

All events should be editable and deletable.

Derived totals should recompute from the event history after any edit.

This is important because one incorrect body-weight entry would otherwise corrupt later calculations.

## Precision

Body weight:

```text
0.01 kg
```

Water:

```text
1 mL internally
```

Display inferred mass out preferably in grams when below 1 kg:

```text
470 g
```

and kilograms for larger totals.

Do not imply precision beyond the scale and measurement method.

## Longer-term views

Once the basic event logging works, support daily summaries such as:

```text
date
water_in_ml
food_mass_in_g
total_mass_in_g
inferred_mass_out_g
first_mass_kg
last_mass_kg
mass_change_kg
```

Useful later charts could include:

* water intake by day
* inferred mass out by day
* body mass through the day
* cumulative mass in versus cumulative mass out
* morning or post-restroom body mass trend

Do not make charts the priority for the first implementation.

## Implementation priority

Build the simplest reliable workflow first:

1. Add the new tab.
2. Add water preset logging.
3. Add the three weight checkpoint types.
4. Pair pre-meal and post-meal measurements.
5. Infer food mass.
6. Infer mass out between checkpoints.
7. Show current-day totals and chronological events.
8. Support edit and delete.
9. Add longer-term summaries later.

Keep data entry extremely fast. The value of this feature depends on the user being willing to record every water container and several body-weight checkpoints per day.
