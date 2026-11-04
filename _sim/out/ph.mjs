const QUESTION_STEM = /\b(are|is|do|does|did|will|would|what|which|how|where|when|who|can|could|any|about)\b/i;
const LIST_SEPARATORS = /,|\bor\b/gi;
const GENERIC_PROMPT = "Type or talk here.";
const TOPIC_PROMPTS = {
  project_type: "Inside, outside, or both?",
  which_rooms: "Which rooms?",
  room_size: "About how big is the room?",
  house_size: "Please estimate square feet",
  surfaces: "Which surfaces?",
  ext_size: "Please estimate square feet",
  ext_trim: "Paint the trim?",
  ext_doors: "Paint the front door?",
  ext_garage: "Paint the garage door?",
  ext_garage_count: "One or two garage doors?",
  ext_gutters: "Paint the gutters?",
  ext_eaves: "Paint the eaves and soffits?",
  ext_windows: "What are the windows made of?",
  ext_window_count: "How many windows?",
  ext_condition: "How is the paint holding up?",
  ext_repairs: "Any repairs needed?",
  ext_color: "Same color or a new one?",
  upsell_ceilings: "Add the ceilings?",
  upsell_trim: "Add the baseboards?",
  upsell_doors: "Add the doors?",
  trim_scope: "What does the trim include?",
  condition: "What shape are the surfaces in?",
  popcorn_extent: "How many rooms have popcorn ceilings?",
  property_ownership: "Do you live there, or is it a rental?",
  color_change: "Same color, or a new one?",
  color_scope_clarify: "How many colors?",
  reno_context: "Where does the other work stand?",
  siding: "What is the outside made of?",
  stories: "How many stories?",
  location: "ZIP code?",
  timeline_and_access: "When would you like it done?"
};
function coreQuestion(text) {
  const flat = text.replace(/\[\[photos?[:|][^\]]*\]\]/g, " ").replace(/\s+/g, " ");
  const questions = flat.match(/[^.!?]*\?/g);
  return questions && questions[questions.length - 1].trim() || flat;
}
function composerPrompt(botText, topicId) {
  if (/\brun it\b/i.test(botText)) return "Anything else to add?";
  const q = coreQuestion(botText);
  if (/\b(square (?:feet|foot|footage)|sq\.? ?ft)\b/i.test(q)) return "Please estimate square feet";
  if (/\blinear (?:feet|foot)\b/i.test(q)) return "About how many linear feet?";
  const many = q.match(/\bhow many ((?!of\b)[a-z-]+(?: [a-z-]+)?)/i);
  if (many) {
    const noun = many[1].replace(/\b(are|is|do|does|did|will|would|you|we|there|need|needs|get|getting|in|on|to|that|of)\b.*$/i, "").trim();
    if (noun) return `How many ${noun}?`;
  }
  if (/\b(living here|live here|rental|renting)\b/i.test(q)) return "Do you live there, or is it a rental?";
  if (/\bzip\b/i.test(q)) return "ZIP code?";
  if (/\b(stories|story)\b/i.test(q)) return "How many stories?";
  if (/\b(interior or exterior|inside,? (?:the )?outside|inside or outside)\b/i.test(q)) return "Inside, outside, or both?";
  if (/\bwhich rooms?\b/i.test(q)) return "Which rooms?";
  if (/\bwhen would you like\b|\btimeline\b/i.test(q)) {
    return /occupied|furnished|empty|vacant/i.test(q) ? "When, and is it occupied or empty?" : "When would you like it done?";
  }
  return topicId && TOPIC_PROMPTS[topicId] || GENERIC_PROMPT;
}
function listLike(s) {
  return (s.match(LIST_SEPARATORS) ?? []).length >= 2;
}
function clean(s) {
  return s.replace(/\s{2,}/g, " ").trim();
}
function splitPrompt(text) {
  let spoken = text;
  const hints = [];
  spoken = spoken.replace(/\(([^)]{8,})\)/g, (_m, inner) => {
    hints.push(inner);
    return "";
  });
  const tail = spoken.match(/^(.*\?)\s+([A-Z][^?.!]*\?)$/s);
  if (tail && listLike(tail[2])) {
    spoken = tail[1];
    hints.push(tail[2].replace(/\?$/, ""));
  } else {
    const dash = spoken.match(/^(.*?[.!?]\s+)?([^.!?]*?)\s[—–]\s([^.!?—–]*\?)$/s);
    if (dash && QUESTION_STEM.test(dash[2]) && dash[2].length >= 15 && listLike(dash[3])) {
      spoken = `${dash[1] ?? ""}${dash[2]}?`;
      hints.push(dash[3].replace(/\?$/, ""));
    }
  }
  return { spoken: clean(spoken), hint: clean(hints.join(" \xB7 ")) };
}
export {
  GENERIC_PROMPT,
  composerPrompt,
  splitPrompt
};
