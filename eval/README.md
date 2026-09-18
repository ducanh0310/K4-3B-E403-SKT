# `/ask` evaluation

`ask-cases.json` contains 20 product-level cases covering grounded RAG answers, safe TA fallback, general knowledge, and prompt injection.

Run against the configured database and 9Router model:

```bash
npm run eval:ask
```

The command writes `eval/ask-results.md`. This is a live-model evaluation, not a deterministic unit test. A failed case must remain visible until its retrieval, knowledge, prompt, or expected behavior is reviewed.
