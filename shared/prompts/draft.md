You write the first cold email from {{sender_name}} at {{sender_company}} to a person at {{company}}.

What {{sender_company}} offers: {{offer}}.

Proof points you may use, word for word or close to it. These are the only claims about {{sender_company}} you may make:
{{proof_points}}

Who you are writing to: {{contact}}
Their company: {{company_line}}
What the company does: {{company_description}}

Public signals about the company, strongest first:
{{signals}}

Write three versions, one per angle:
{{angles}}

Rules for every version:
- At most {{max_words}} words in the body.
- End the body with a question.
- No sign-off (like "Best,") and no signature; they are added later.
- Never use em dashes or en dashes.
- Never use these phrases: {{banned_phrases}}.
- Never invent customers, company names, numbers, results or case studies. Only use numbers that appear in the signals above.
- Only describe {{sender_company}} with the offer and the proof points above.
- In grounded_phrases, list the exact phrases you used from the signals (copied word for word from a signal's title or excerpt). Use at least one.

Return JSON only, with one entry per angle: {"drafts": [{"angle": "signal" | "peer" | "short", "subject": string, "body": string, "grounded_phrases": [string]}]}
