# Genre And Naturalness Contract

This resource defines the production contract used when a project chooses a genre, style profile, and naturalness target.

## Creation-Time Genre Selection

Every project must resolve these fields before long-running production:

- genre: fantasy, xianxia, urban, romance, suspense, court politics, historical, science fiction, light novel, or custom.
- platform: serialized web novel, publication-style novel, short fiction, or custom.
- reader promise: satisfaction, mystery, emotion, romance, power growth, political tension, horror, or slice-of-life texture.
- point of view: first person, third-person limited, or third-person omniscient.
- tone: warm, comedic, tense, dark, passionate, restrained, or custom.
- naturalness target: light, balanced, or strict.
- reference style sample: optional, used to create a style fingerprint.

## Genre Contract Fields

Each genre contract should provide:

- narration strategy.
- hook pattern.
- pacing pressure and release rhythm.
- chapter ending rule.
- dialogue ratio.
- common poison points.
- reader payoff type.
- scene vocabulary categories.
- naturalness risks.

## Style Contract Fields

Each style contract should provide:

- sentence length distribution.
- paragraph length range.
- dialogue tag preference.
- idiom density.
- classical wording ratio.
- emotional distance.
- narrator intervention level.
- character voice differentiation rules.

## Character Profile Contract

Every important character requires:

- canonical name.
- identity and role function.
- core desire.
- fear or wound.
- contradiction.
- behavior habit.
- speech marker.
- appearance or body marker.
- skill, limitation, and cost.
- relationship state.
- current chapter delta.

Characters must be differentiated through action, choice, voice, body detail, and relationship pressure. Do not rely on labels such as cold, kind, clever, proud, tragic, or mysterious.

## NaturalnessAgent Contract

NaturalnessAgent is a required production stage after draft generation and before final artifact commit.

It must:

- preserve facts, names, relationships, objects, foreshadowing, world rules, and chapter consequences.
- prefer local patch-style rewrites over whole-chapter rewrites.
- remove report language, analytical narration, generic summaries, and forced uplift endings.
- externalize emotion through action, silence, interruption, physical response, object handling, and relationship pressure.
- make dialogue carry intent, subtext, omission, conflict, or status change.
- break overly regular sentence rhythm.
- keep idioms and advanced vocabulary contextual and sparse.
- preserve the chapter hook and next-chapter handoff.

It must not:

- add new plot facts.
- change character identity or relationship state.
- solve unresolved hooks.
- rewrite style into a different genre promise.
- remove locked protagonist names or continuity anchors.

## Naturalness Gate

The gate blocks when it detects:

- repeated short-word fragments.
- stacked idioms or vocabulary dumps.
- report-like transitions such as firstly, secondly, therefore, in summary.
- narrator conclusions replacing scene evidence.
- emotion labels dominating embodied action.
- long chapters with no dialogue or character voice.
- missing character profile signals.
- changed continuity anchors.

The gate can pass with warnings only when facts are preserved and the remaining issues are stylistic, not structural.
