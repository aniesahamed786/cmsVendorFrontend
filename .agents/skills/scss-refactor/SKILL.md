---
name: scss-refactor
description: Refactor a feature folder in this CMS vendor app from Tailwind utilities and hard-coded colors to clean BEM templates + SCSS with design tokens. Use whenever asked to "remove the hard-coded styling and tailwind styling" from a component/feature, de-Tailwind a page, clean up a template, or convert legacy styling to the token system.
---

# SCSS refactor — read `style/REFACTOR.md`

This skill is the **trigger**, not the procedure. The procedure lives in one place so it
can't drift:

## → [`.claude/skills/style/REFACTOR.md`](../style/REFACTOR.md)

Read it and follow it start to finish. It covers the target (a template with only BEM
classes), scope rules, the inventory greps, the hex→token map, what to **delete** rather
than rewrite (fields/filters/buttons are already global or shared), the table rule, and the
verification matrix.

Supporting docs it links to: [`style/SKILL.md`](../style/SKILL.md) for the per-element
recipes and token vocabulary, [`style/SKELETON.md`](../style/SKELETON.md) and
[`style/number_animation.md`](../style/number_animation.md) for loading states, and the
[`button`](../button/SKILL.md) and [`page-chrome`](../page-chrome/SKILL.md) skills.

> Superseded: this file used to carry its own shorter playbook that let layout utilities
> stay in the template and banned all global edits. Both rules changed — `REFACTOR.md` is
> authoritative.
