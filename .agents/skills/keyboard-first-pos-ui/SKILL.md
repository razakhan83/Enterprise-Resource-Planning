---
name: keyboard-first-pos-ui
description: Hotkeys, anti-AI dense layout, and 80mm thermal receipt CSS.
---

# Keyboard-First POS UI Standard

## Objective
Deliver maximum billing velocity for fast wholesale counter operations (e.g., Jodia Bazar, Badami Bagh) allowing operators to complete transactions completely without a mouse.

## Mandatory Rules
1. **Global Keyboard Shortcuts**:
   - `F2`: Focus POS Counter / Quick Item Search
   - `F3`: Open Party Directory Modal (Customer/Supplier selection)
   - `F4`: Navigate to Inward Purchase Entry
   - `F7`: Open Payment / Receipt Voucher Modal
   - `Ctrl + Enter`: Commit Transaction and Trigger Instant 80mm Print
   - `Escape`: Cancel modal / Clear active entry / Reset line

2. **Tabular Fast-Entry Navigation**:
   - Pressing `Enter` in the active input row must automatically advance focus to the next field in sequence:
     `Item Search -> Unit (Parent/Child) -> Quantity -> Rate -> Discount -> Add to Cart`
   - Adding an item returns cursor focus immediately to `Item Search` for the next line item.

3. **High-Density Anti-AI Interface Standards**:
   - Use grounded, enterprise-grade neutral tones (`#F8F9FA`, `#FAFAFA`, `#F4F4F5`, `#18181B`).
   - Pure black text on crisp, high-contrast borders (`1px solid #E5E7EB`).
   - Font: Clean sans-serif for labels; tabular monospaced numbers (`font-mono`) for monetary quantities and rates.
   - Absolutely NO emojis in headings or status badges; use clean semantic icons (Tabler/Phosphor).
   - Zero slow animations; transitions capped under 150ms.
