# Arabic Glossary

Binding terminology for all i18n phases. Subagents must use these exact terms;
anything not listed gets flagged in the phase report rather than invented.

## Source of truth: OfferApp

The sibling app `~/OfferApp` ships 445 translated keys covering the same domain.
**Where a term exists there, we match it** — the two apps face the same users and
diverging vocabulary between them is a defect, not a style choice.

| English | Arabic | Note |
|---|---|---|
| Vendor | `البائع` | OfferApp's choice. Not `المورّد` (procurement/supply) and not `التاجر` (retail merchant). |
| Vendors | `البائعون` | |
| Branch | `الفرع` | |
| Branches | `الفروع` | |
| Redeem | `استرد` | So Redemption → `الاسترداد`. |

## Do not translate

**Highlight** — being removed from the product. Leave every Highlight string in
English and add no keys for it. It is still in the code and the API today
(`highlight_title`, `highlight_description`, `highlight_image`, rendered in
`offer-form.html`, `offer-details.html` and `analytics-page.html`), so phase
reports should note when they walk past one rather than translating it.

## Store vs Branch — settled

They are the same concept and the code now says **branch** everywhere it means a
place. Two things deliberately still say "store" and **must not be renamed**:

| Keep | Why |
|---|---|
| `In-Store`, `in store`, `in-store` | A redemption *channel*, the opposite of Online/Digital — not a place. `'in store'` is also the literal API payload value in `OfferModePayload`. |
| `MessagingCenterStore`, `messaging-center-store.ts`, `inject(...)` as `store` | A state container. Nothing to do with shops. |

`offer-form.ts:1904` pairs the channel label as `["in-store", "في المتجر"]`.
That Arabic reads "at the store"; if you want the channel to read `في الفرع`
instead, say so — it was left alone as channel vocabulary.

## Navigation

| English | Arabic |
|---|---|
| Dashboard | لوحة التحكم |
| Vendor Profile | ملف البائع |
| Request Center | مركز الطلبات |
| Offers | العروض |
| Branches | الفروع |
| Redemption | الاسترداد |
| Messaging Center | مركز الرسائل |
| Analytics | التحليلات |
| Recent Activities | النشاطات الأخيرة |

## Offer domain

| English | Arabic |
|---|---|
| Offer | عرض |
| Discount | خصم |
| Discount code | رمز الخصم |
| Start date | تاريخ البدء |
| Expiry | تاريخ الانتهاء |
| Instructions | التعليمات |
| Terms & Conditions | الشروط والأحكام |
| Target audience | الفئة المستهدفة |
| Category | الفئة |
| Season | الموسم |
| Room | غرفة |
| Hotel | فندق |
| Amenities | المرافق |
| Tax | الضريبة |
| Currency | العملة |
| Total amount | المبلغ الإجمالي |

## Status

| English | Arabic |
|---|---|
| Status | الحالة |
| Active | نشط |
| Inactive | غير نشط |
| Pending | قيد المراجعة |
| Approved | معتمد |
| Rejected | مرفوض |
| Expired | منتهي |
| Draft | مسودة |

## Actions

| English | Arabic |
|---|---|
| Save | حفظ |
| Cancel | إلغاء |
| Edit | تعديل |
| Delete | حذف |
| Create | إنشاء |
| Add | إضافة |
| Upload | رفع |
| Search | بحث |
| Filter | تصفية |
| Export | تصدير |
| Submit | إرسال |
| Back | رجوع |
| Next | التالي |
| Previous | السابق |
| Confirm | تأكيد |
| Close | إغلاق |

## Account / chrome

| English | Arabic |
|---|---|
| Profile | الملف الشخصي |
| Settings | الإعدادات |
| Logout | تسجيل الخروج |
| Dark theme | الوضع الداكن |
| User ID | معرّف المستخدم |
| Ticket | تذكرة |

## Key naming

Nested by page, matching the JSON shape: `offers.list.emptyState`, not `text1`.
The page prefix mirrors the route folder so an agent working one page owns one
top-level object and phases never collide in the same JSON region.

## Conventions

- **Numerals stay Western** (`50`, not `٥٠`) until you say otherwise. Mixed
  Arabic-Indic numerals inside an LTR-marked amount is a common rendering mess.
- **Keep `dir="ltr"`** on phone numbers, amounts, dates, and IDs. Without it the
  digits and `%` reorder inside the RTL page.
- **No transliteration** of English product words that already have accepted
  Arabic equivalents.
- Placeholders and `aria-label`s get translated too — they are strings the user
  reads or hears, so they need keys like anything else.
- Interpolation uses `{{name}}` inside the JSON value, passed as
  `{{ 'key' | translate : { name: x } }}`. The spec enforces that both languages
  declare the same params.
