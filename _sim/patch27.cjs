const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  const beds = extractBedroomCount(text);\n  if (beds && !prev.bedroomCount) {";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, String.raw`  // Short replies are answers to the question just asked: "two" to "how many stories?", "nights" to "after hours?",
  // "commercial" to "is this your home?". The sentence-style extractors below need the full phrasing.
  if (lastBotTopicId === 'stories' && !prev.stories) {
    const low = text.toLowerCase().trim();
    const n = /^(?:about |around )?(?:one|1|single|ground level|ranch)\b/.test(low) ? 1 : /^(?:about |around )?(?:two|2|double)\b/.test(low) ? 2 : /^(?:about |around )?(?:three|3|triple)\b/.test(low) ? 3 : null;
    if (n) {
      patch.stories = n;
      acks.push(n + '-story');
    }
  }
  if (lastBotTopicId === 'commercial_access' && !prev.afterHoursRequired) {
    const low = text.toLowerCase();
    if (/\b(nights?|overnight|evenings?|after[\s-]?hours|weekends?|early (?:morning|mornings)|before (?:we )?open|mondays?|closed (?:on|mondays?)|outside (?:of )?business hours)\b/.test(low)) {
      patch.afterHoursRequired = 'yes';
      acks.push('after-hours scheduling');
    } else if (/\b(weekdays?|daytime|during the day|any ?time|anytime|business hours|doesn'?t matter|no preference|we can close|closed (?:for|during)|closed is fine|closed)\b/.test(low)) {
      patch.afterHoursRequired = 'no';
    }
  }
  if (lastBotTopicId === 'property_ownership' && !prev.propertyType && !patch.propertyType) {
    const low = text.toLowerCase();
    if (/\b(commercial|business|company|store|shop|restaurant|office|church|clinic|warehouse|salon|cafe|gym)\b/.test(low)) {
      patch.propertyType = 'commercial';
      acks.push('commercial');
    }
  }

  const beds = extractBedroomCount(text);
  if (beds && !prev.bedroomCount) {`);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
