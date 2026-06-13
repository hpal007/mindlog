// Lane B — deterministic safety backstop. NO LLM. Safety-critical.
//
// Defense-in-depth alongside the model's structured risk_level: either signal can
// trip the crisis path, so a model miss still surfaces helplines. This pass is
// deliberately conservative toward catching genuine self-harm/suicidal ideation,
// while excluding the common Indian exam-venting idioms that LOOK alarming but are
// figurative ("this exam is killing me", "I'm dead if I fail", "dying to get into
// IIT", "this syllabus is murder").
import type { KeywordRisk } from "@/lib/ai/contract";
import type { RiskLevel } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Idiom exclusions — figurative exam venting that must NOT be flagged acute.
// Checked FIRST; matched spans are blanked before acute scanning so a literal
// "kill/die/dead/murder" inside an idiom can't trip a false positive.
// ---------------------------------------------------------------------------
export const EXAM_IDIOM_PATTERNS: readonly RegExp[] = [
  // "this exam / test / paper / physics is killing me", "the syllabus is killing me"
  /\b(?:this|the|that|my)\b[^.!?\n]{0,40}?\b(?:exam|test|paper|syllabus|portion|backlog|prep|preparation|chapter|subject|physics|chemistry|maths?|biology|course)\b[^.!?\n]{0,20}?\b(?:is|are|are\s+gonna|is\s+gonna|will)\b[^.!?\n]{0,20}?\bkill(?:ing|s)?\s+me\b/gi,
  // "... is murder", "this syllabus is (sheer) murder"
  /\b(?:this|the|that|my)\b[^.!?\n]{0,40}?\b(?:exam|test|paper|syllabus|portion|backlog|prep|chapter|subject|physics|chemistry|maths?|biology|course)\b[^.!?\n]{0,20}?\bis\b[^.!?\n]{0,12}?\bmurder\b/gi,
  // "I'm dead / I am dead / I'm so dead / dead meat if I fail|don't|can't ..."
  /\bi(?:'m|\s+am)\s+(?:so\s+|totally\s+|absolutely\s+|basically\s+)?dead(?:\s+meat)?\b(?=[^.!?\n]{0,40}\b(?:if|when|after|unless|cause|because|coz|cuz)\b)/gi,
  // "dead if I fail / dead if I don't ..." (without leading "I'm")
  /\bdead\b[^.!?\n]{0,20}?\bif\b[^.!?\n]{0,30}?\b(?:fail|flunk|don'?t|can'?t|miss|score|rank|qualify)\b/gi,
  // "dying to <verb>" / "dying to get into IIT" — eager, not suicidal
  /\bdying\s+to\s+\w+/gi,
  // "I could die" / "I'd die" of embarrassment/boredom etc. (figurative)
  /\bi(?:'d|\s+would|\s+could|\s+might)\s+(?:just\s+)?die\b(?=[^.!?\n]{0,30}\b(?:of|from|embarrass|bored|shame|laugh|happy|cringe)\b)/gi,
  // "killed it / killing it" (did great)
  /\b(?:killed|killing|smashed|nailed)\s+(?:it|the\s+\w+)\b/gi,
];

// ---------------------------------------------------------------------------
// ACUTE — explicit self-harm / suicidal intent or ideation. Exported for tests.
// Run AFTER idioms are stripped. Word-boundary anchored.
// ---------------------------------------------------------------------------
export const ACUTE_PATTERNS: readonly RegExp[] = [
  /\bsuicid(?:e|al)\b/i,
  /\bkill(?:ing)?\s+(?:my\s*self|myself)\b/i,
  /\bend(?:ing)?\s+(?:my\s+life|it\s+all|myself|things)\b/i,
  /\btake\s+my\s+(?:own\s+)?life\b/i,
  /\b(?:want|wanna|going|trying|plan(?:ning)?|ready)\s+to\s+die\b/i,
  /\bi\s+(?:want|wish|wanna)\s+to\s+(?:be\s+)?(?:dead|disappear\s+forever)\b/i,
  /\b(?:don'?t|do\s+not|no\s+longer)\s+(?:want|wanna|wish)\s+to\s+(?:be\s+alive|live|exist|wake\s+up|go\s+on)\b/i,
  /\bdon'?t\s+want\s+to\s+(?:be\s+(?:here|alive)|exist|live)\b/i,
  /\bno\s+(?:reason|point|will|wish)\s+to\s+(?:live|go\s+on|keep\s+going|be\s+alive)\b/i,
  /\b(?:better\s+off|everyone.{0,12}better)\s+(?:dead|without\s+me|if\s+i.{0,12}(?:gone|dead|wasn'?t))\b/i,
  /\bhurt(?:ing)?\s+(?:my\s*self|myself)\b/i,
  /\bharm(?:ing)?\s+(?:my\s*self|myself)\b/i,
  /\bcut(?:ting)?\s+(?:my\s*self|myself)\b/i,
  /\bself[\s-]?harm\b/i,
  /\bself[\s-]?harming\b/i,
  /\bi\s+(?:can'?t|cannot)\s+(?:do\s+this|live)\s+anymore\b[^.!?\n]{0,30}\b(?:die|end|gone|alive)\b/i,
  /\b(?:want\s+to|gonna|going\s+to)\s+jump\s+(?:off|from)\b/i,
  /\boverdose\b/i,
];

// ---------------------------------------------------------------------------
// ELEVATED — notable distress / hopelessness / inability to cope (not acute).
// ---------------------------------------------------------------------------
export const ELEVATED_PATTERNS: readonly RegExp[] = [
  /\bhopeless(?:ness)?\b/i,
  /\bworthless(?:ness)?\b/i,
  /\b(?:i\s+(?:am|'m|feel)\s+)?useless\b/i,
  /\b(?:can'?t|cannot)\s+(?:go\s+on|take\s+(?:it|this)\s+anymore|cope|handle\s+(?:it|this)\s+anymore|do\s+this\s+anymore)\b/i,
  /\bi\s+give\s+up\b/i,
  /\bgiving\s+up\s+on\s+everything\b/i,
  /\bnothing\s+(?:matters|makes\s+sense)\s+anymore\b/i,
  /\b(?:so|completely|utterly)\s+(?:alone|empty|numb)\b/i,
  /\bfeel(?:ing)?\s+(?:so\s+)?(?:empty|numb|trapped|broken)\b/i,
  /\bi\s+(?:am|'m)\s+(?:a\s+)?(?:complete\s+)?failure\b/i,
  /\bno\s+one\s+(?:would\s+)?(?:care|notice|miss\s+me)\b/i,
  /\bcan'?t\s+see\s+(?:a\s+)?(?:point|future|way\s+out)\b/i,
  /\bburn(?:t|ed)?\s+out\b/i,
  /\bdrowning\b/i,
];

function firstMatch(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Deterministic risk classification of free text.
 * Returns "acute" for explicit self-harm/suicidal signals, "elevated" for notable
 * distress, "none" otherwise. Exam idioms are excluded before acute scanning.
 */
export const keywordRisk: KeywordRisk = (text: string): RiskLevel => {
  if (!text || !text.trim()) return "none";

  // Blank out figurative exam idioms so they can't trip the acute scan.
  let scrubbed = text;
  for (const idiom of EXAM_IDIOM_PATTERNS) {
    scrubbed = scrubbed.replace(idiom, " ");
  }

  if (firstMatch(ACUTE_PATTERNS, scrubbed)) return "acute";
  if (firstMatch(ELEVATED_PATTERNS, text)) return "elevated";
  return "none";
};
