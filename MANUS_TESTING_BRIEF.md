# Manus Testing Brief

## Goal
Use Kindcipe like a real user and report the first meaningful bug in each flow.

## Test Order
1. Core 10 scenarios in `CORE_10_SCENARIOS.md`
2. Then expand to more edge cases only after the core flows pass

## Bug Report Template
- Scenario ID
- What you did
- What happened
- What you expected
- Severity: P0 / P1 / P2 / P3
- Screenshot or recording
- Notes about device, iOS version, network, and account state

## Severity Rules
- P0: crash, login blocked, or core feature unusable
- P1: feature works incorrectly or data is lost
- P2: UI / timing / copy issue, but workaround exists
- P3: suggestion or minor polish

## Stop Rule
If any P0 appears, stop testing and report immediately.

## What to Focus On
- Login and biometric flow
- AI Chef generation and recipe cards
- Meal plan add / delete / confirm
- Shopping list add / toggle bought / approve / reject
- Family sharing
- Pantry management
- Deep links and app relaunch behavior

## What to Ignore for First Pass
- Cosmetic layout polish
- Rare edge cases
- Long-tail scenarios until core flows are stable
