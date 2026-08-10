# ArbZG — German Working Time Limits

Research note for deciding which validation rules a personal work-time log can implement.
Primary source: statute text at [gesetze-im-internet.de/arbzg](https://www.gesetze-im-internet.de/arbzg/), plus [BMAS](https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Arbeitnehmerrechte/Arbeitszeitschutz/arbeitszeitschutz.html) for official framing. No secondary/commercial sources used as a basis for any claim.

**Global framing (matters for every rule below):** ArbZG obligations bind the **employer**. [§ 22 Abs. 1](https://www.gesetze-im-internet.de/arbzg/__22.html) opens: *"Ordnungswidrig handelt, wer als Arbeitgeber vorsätzlich oder fahrlässig …"*. A self-logged record that breaches a limit is evidence about **employer compliance**, never employee misconduct. Recording duty is also the employer's: [§ 16 Abs. 2](https://www.gesetze-im-internet.de/arbzg/__16.html) requires the employer to record time *"über die werktägliche Arbeitszeit des § 3 Satz 1 hinausgehende"* and keep it ≥ 2 years.

**Definition of Arbeitszeit** — [§ 2 Abs. 1](https://www.gesetze-im-internet.de/arbzg/__2.html): *"Arbeitszeit im Sinne dieses Gesetzes ist die Zeit vom Beginn bis zum Ende der Arbeit ohne die Ruhepausen."* → **net of breaks**. A log's gross span must have breaks subtracted before comparing to § 3.

---

## 1. § 3 — maximum daily working time

[§ 3](https://www.gesetze-im-internet.de/arbzg/__3.html):

> "Die werktägliche Arbeitszeit der Arbeitnehmer darf acht Stunden nicht überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht überschritten werden."

- Base: **8 h** per Werktag.
- Extension to **10 h** is allowed **only if** the average over **six Kalendermonate _or_ 24 Wochen** does not exceed **8 h werktäglich**. The employer picks the reference period; it is a rolling/either-or choice, not both.
- **10 h is a hard ceiling** under § 3 — no averaging permits 11 h.
- Binds: employer. Carve-outs: [§ 18](https://www.gesetze-im-internet.de/arbzg/__18.html) (below). Variation: [§ 7](https://www.gesetze-im-internet.de/arbzg/__7.html) (below).

## 2. "werktäglich" — is Saturday a Werktag?

**Yes.** Werktage are Monday–Saturday; the statute treats only Sundays and gesetzliche Feiertage as non-working days, via the separate prohibition in [§ 9 Abs. 1](https://www.gesetze-im-internet.de/arbzg/__9.html) (*"an Sonn- und gesetzlichen Feiertagen von 0 bis 24 Uhr nicht beschäftigt werden"*). BMAS: *"The weekly rest day is basically Sunday."* Saturday is not excluded anywhere in the statute.

Implied weekly maxima (6 Werktage):
- **6 × 8 = 48 h/week** as the sustained maximum (the figure the § 3 average enforces).
- **6 × 10 = 60 h/week** as the absolute peak week, permissible only if the 8 h/Werktag average over 6 months / 24 weeks still holds.

## 3. § 5 — Ruhezeit (rest between working days)

[§ 5 Abs. 1](https://www.gesetze-im-internet.de/arbzg/__5.html):

> "Die Arbeitnehmer müssen nach Beendigung der täglichen Arbeitszeit eine ununterbrochene Ruhezeit von mindestens elf Stunden haben."

- Base: **11 h uninterrupted**, measured **end of one working day → start of the next**. Any work touching that window breaks it.
- **Abs. 2**: reduction by **up to 1 h (→ 10 h)** in named sectors — Krankenhäuser und andere Einrichtungen zur Behandlung/Pflege/Betreuung von Personen, Gaststätten und sonstige Einrichtungen zur Bewirtung und Beherbergung, Verkehrsbetriebe, Rundfunk, Landwirtschaft — **only if** every such shortening is compensated by extending **another** rest period to **at least 12 h**, within **one Kalendermonat or four Wochen**.
- **Abs. 3**: in treatment/care facilities, Kürzungen durch Inanspruchnahme während der Rufbereitschaft may be compensated at other times, provided they do not exceed half the rest period. Abs. 4 aufgehoben.
- Binds: employer.

## 4. §§ 9–11 — Sunday and public-holiday work

**[§ 9 Abs. 1](https://www.gesetze-im-internet.de/arbzg/__9.html) — general prohibition:** *"Arbeitnehmer dürfen an Sonn- und gesetzlichen Feiertagen von 0 bis 24 Uhr nicht beschäftigt werden."* Abs. 2 allows shifting the 24-h rest window by up to 6 h in continuous multi-shift operations (if the plant is closed for the following 24 h); Abs. 3 allows a 2-h forward shift for Kraftfahrer/Beifahrer.

**[§ 10](https://www.gesetze-im-internet.de/arbzg/__10.html) — exceptions.** Abs. 1 lists 16 sector categories in which Sunday/holiday employment is permitted *abweichend von § 9*, condensed:
Not- und Rettungsdienste/Feuerwehr (1); öffentliche Sicherheit und Ordnung, Gerichte/Behörden, Verteidigung (2); Krankenhäuser und Pflege-/Betreuungseinrichtungen (3); Gaststätten/Beherbergung und Haushalt (4); Musik-, Theater-, Film- und ähnliche Aufführungen (5); kirchliche/religiöse Veranstaltungen (6); Sport, Freizeit, Fremdenverkehr, Museen, wissenschaftliche Bibliotheken (7); Rundfunk, Presse, Nachrichtenagenturen und zugehörige Produktion (8); Messen, Ausstellungen, Märkte, Volksfeste (9); Verkehrsbetriebe und Umgang mit verderblichen Waren (10); Energie-, Wasser-, Abfall- und Abwasserversorgung (11); Landwirtschaft, Tierhaltung, Veterinäreinrichtungen (12); Bewachung/Objektschutz (13); Reinigung, Instandhaltung, Betrieb von IT-Infrastruktur (14); Verhinderung von Verderb oder Abbruch von Forschungsarbeiten (15); Schutz vor Zerstörung oder erheblicher Schädigung von Produktionsanlagen (16).
Abs. 2 permits production work where maintenance would otherwise require more staff than continuous production; Abs. 3 permits bakeries/confectioners up to 3 h; Abs. 4 covers financial-services payment/trading on non-uniform EU holidays.

**[§ 11](https://www.gesetze-im-internet.de/arbzg/__11.html) — Ausgleich:**
- Abs. 1: *"Mindestens 15 Sonntage im Jahr müssen beschäftigungsfrei bleiben."*
- Abs. 2: Sunday/holiday work still obeys §§ 3–8; maxima of §§ 3, 6 Abs. 2, 7, 21a Abs. 4 apply unchanged.
- Abs. 3 — **Ersatzruhetag**: for **Sunday** work, a replacement rest day **within a 2-week period including the day worked**; for a **Feiertag falling on a Werktag**, **within an 8-week period including the day worked**.
- Abs. 4: the Sunday/holiday rest or the Ersatzruhetag is to be granted **in unmittelbarem Zusammenhang mit einer Ruhezeit nach § 5**, unless technical/organisational reasons prevent it.
- Binds: employer.

## 5. Is Saturday work restricted?

**No — there is no Saturday-specific restriction in the ArbZG.** Saturday is an ordinary Werktag. Only the general rules apply: the [§ 3](https://www.gesetze-im-internet.de/arbzg/__3.html) 8/10-h daily limit and its 6-month/24-week average, the [§ 4](https://www.gesetze-im-internet.de/arbzg/__4.html) breaks, and the [§ 5](https://www.gesetze-im-internet.de/arbzg/__5.html) 11-h rest. There is no Ersatzruhetag entitlement for Saturday work and no ArbZG surcharge. (Saturday work may be limited by Tarifvertrag/Arbeitsvertrag — outside the statute.)

## 6. Times of day — is working at 03:00 prohibited?

**No.** ArbZG contains **no permitted-hours window** for Werktage. Night work is **regulated, not prohibited**. The only clock-time prohibition is the Sunday/holiday 0–24 h ban in [§ 9](https://www.gesetze-im-internet.de/arbzg/__9.html).

Definitions, [§ 2](https://www.gesetze-im-internet.de/arbzg/__2.html):
- **Abs. 3 Nachtzeit**: *"die Zeit von 23 bis 6 Uhr, in Bäckereien und Konditoreien die Zeit von 22 bis 5 Uhr"*.
- **Abs. 4 Nachtarbeit**: *"jede Arbeit, die mehr als zwei Stunden der Nachtzeit umfaßt"*.
- **Abs. 5 Nachtarbeitnehmer**: those who work Nachtarbeit in Wechselschicht, **or** perform Nachtarbeit on **at least 48 Kalendertagen im Jahr**.

[§ 6](https://www.gesetze-im-internet.de/arbzg/__6.html) then requires of the **employer**:
- **Abs. 1**: shift/night schedules must follow *"gesicherte arbeitswissenschaftliche Erkenntnisse über die menschengerechte Gestaltung der Arbeit"*.
- **Abs. 2**: for Nachtarbeitnehmer the daily limit is again 8 h, extendable to 10 h only if the average of 8 h werktäglich holds over **one Kalendermonat or four Wochen** — a **stricter averaging window** than § 3's six months / 24 weeks.
- **Abs. 3**: right to arbeitsmedizinische Untersuchungen before starting and every 3 years, **annually from age 50**; employer bears the cost or offers them free via Betriebsarzt.
- **Abs. 4**: on request, transfer to a suitable Tagesarbeitsplatz (health risk, child under 12, pflegebedürftiger Angehöriger) unless dringende betriebliche Erfordernisse oppose it.
- **Abs. 5**: absent tarifvertragliche Ausgleichsregelungen, the employer must grant *"eine angemessene Zahl bezahlter freier Tage oder einen angemessenen Zuschlag auf das … Bruttoarbeitsentgelt"* for hours worked during Nachtzeit.
- **Abs. 6**: equal access to Weiterbildung.

## 7. § 4 — Ruhepausen (breaks)

[§ 4](https://www.gesetze-im-internet.de/arbzg/__4.html), verbatim:

> "Die Arbeit ist durch im voraus feststehende Ruhepausen von mindestens 30 Minuten bei einer Arbeitszeit von mehr als sechs bis zu neun Stunden und 45 Minuten bei einer Arbeitszeit von mehr als neun Stunden insgesamt zu unterbrechen. Die Ruhepausen nach Satz 1 können in Zeitabschnitte von jeweils mindestens 15 Minuten aufgeteilt werden. Länger als sechs Stunden hintereinander dürfen Arbeitnehmer nicht ohne Ruhepause beschäftigt werden."

- Trigger is **"mehr als sechs Stunden"** — **strictly more than 6 h**, *not* "at least 6 h". Exactly 6.00 h requires **no** break. > 6 h to 9 h → **30 min**. **> 9 h → 45 min**.
- Breaks must be **im voraus feststehend** (fixed in advance) and may be split into blocks of **at least 15 min each**.
- Satz 3: **never more than 6 h consecutive** work without a break — an independent rule that can be breached even when the daily total is compliant.
- Break time is **not Arbeitszeit** ([§ 2 Abs. 1](https://www.gesetze-im-internet.de/arbzg/__2.html)).
- Binds: employer.

---

## Variation by Tarifvertrag / Betriebsvereinbarung

[**§ 7**](https://www.gesetze-im-internet.de/arbzg/__7.html) — a Tarifvertrag, or a Betriebs-/Dienstvereinbarung **based on** one, may (direction: **loosening**):
- extend the werktägliche Arbeitszeit **beyond 10 h without compensation** where *"regelmäßig und in erheblichem Umfang Arbeitsbereitschaft oder Bereitschaftsdienst"* falls in the time (Abs. 1 Nr. 1a);
- set a **different Ausgleichszeitraum** than § 3's;
- **shorten the Ruhezeit** in Schichtbetrieb/Verkehrsbetrieb by **up to 2 h**, with compensation;
- Abs. 2a: extend beyond 8 h **even without Ausgleich** where standby is a substantial share, subject to health-protection measures; requires the employee's **written consent**, revocable with 6 months' notice, with anti-retaliation protection (Abs. 7).
- **Outer bounds (Abs. 8)**: average must not exceed **48 h/week over 12 Kalendermonate** (6 months where based on behördliche Bewilligung). **Abs. 9**: if daily work exceeds 12 h, a rest period of **at least 11 h must immediately follow**.

[**§ 12**](https://www.gesetze-im-internet.de/arbzg/__12.html) — same instruments may vary the Sonn-/Feiertagsruhe rules: reduce the beschäftigungsfreie Sonntage from 15 to **at least 10** (fewer for Rundfunk, Theater, Orchester, Schausteller, Filmtheater, Tierhaltung); waive Ersatzruhetage for Feiertage falling on Werktage; in kontinuierlicher Schichtbetrieb extend Sunday/holiday shifts to **12 h** where this yields extra free shifts.

## Who is covered

- Applies to **Arbeitnehmer** = *"Arbeiter und Angestellte sowie die zu ihrer Berufsbildung Beschäftigten"* ([§ 2 Abs. 2](https://www.gesetze-im-internet.de/arbzg/__2.html)).
- **Does not apply to the self-employed** (Selbständige/Freelancer) — they are not Arbeitnehmer. A freelancer's 14-h day breaches nothing in ArbZG.
- [**§ 18 Abs. 1**](https://www.gesetze-im-internet.de/arbzg/__18.html) excludes: **leitende Angestellte i.S.d. § 5 Abs. 3 BetrVG sowie Chefärzte**; leaders in public service with personnel-decision authority; employees living with and independently caring for assigned persons; the **liturgischer Bereich** of churches/religious communities.
- Abs. 2: under-18s → **JArbSchG** instead (stricter). Abs. 3: seagoing crew → maritime labour law.

---

## What this means for a personal work-time log

**Checkable from the log alone (deterministic, worth implementing):**
- Daily **net** Arbeitszeit (gross span minus logged breaks) > **8 h** → allowed only under the averaging rule; flag as informational.
- Daily net > **10 h** → hard § 3 breach unless a § 7 Tarifvertrag applies.
- **Break shortfall**: net > 6 h with < 30 min break; net > 9 h with < 45 min break; any break block < 15 min not counting toward the minimum.
- **> 6 h continuous** work with no break in between (§ 4 S. 3) — computable from intra-day segments.
- **Rest between consecutive days** < **11 h** (end of day N → start of day N+1), including across weekends.
- **Sunday / gesetzlicher Feiertag** entries present at all (needs a holiday calendar, which is Bundesland-specific).
- **Nachtzeit overlap**: any minutes in 23:00–06:00; and > 2 h overlap → the day is *Nachtarbeit* per § 2 Abs. 4.
- **Nachtarbeitnehmer status**: count days with Nachtarbeit ≥ **48/year** → then apply the stricter § 6 Abs. 2 averaging (1 month / 4 weeks).
- **Weekly totals** > 48 h (sustained) and > 60 h (absolute peak week).
- **Rolling averages**: 8 h/Werktag over 24 weeks or 6 calendar months — computable *if* the log covers the full window; otherwise report "insufficient data".
- **< 15 beschäftigungsfreie Sonntage** in a calendar year (§ 11 Abs. 1) — computable over a full year of data.
- **Missing Ersatzruhetag**: no full free day within 2 weeks around a worked Sunday / 8 weeks around a worked Feiertag — computable but only reliable if non-work days are unambiguously recorded (absence of an entry ≠ a rest day, unless the app records that).

**Not judgeable from a log alone (do not assert illegality):**
- Whether the employer elected the 6-month or 24-week reference period, and whether the average is met **outside** the logged range.
- Whether a **§ 7 / § 12 Tarifvertrag or Betriebsvereinbarung** raises the limits (10 h+, 2-h Ruhezeit cut, 10 Sundays, 12-h Sunday shifts).
- Whether a **§ 5 Abs. 2** sector exception (hospital, hospitality, transport, broadcasting, agriculture) permits the 10-h rest, and whether the 12-h compensating rest was granted elsewhere.
- Whether a **§ 10** exception category legitimises the Sunday/holiday work.
- Whether the user is exempt under **§ 18** (leitender Angestellter) or is self-employed — ArbZG then does not bind at all.
- Whether unpaid breaks were actually taken but simply not logged, or logged gross time includes non-Arbeitszeit.
- Whether the § 6 Abs. 3/5 medical checks and night surcharge were provided.

**Framing rule for any warning the app shows:** phrase findings as *"this record shows a pattern that would exceed the § 3 limit / § 5 rest — that is the employer's obligation"*, never as the user having done something unlawful. Cite the § so the user can check the exception themselves.
