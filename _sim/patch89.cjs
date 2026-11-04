const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

// ---- compression helper + limits
patch('src/lib/chatEstimator/photoUpload.ts', [
  ["const BUCKET = 'quote-photos';\n", `const BUCKET = 'quote-photos';

/** The popup takes up to this many photos. */
export const MAX_POPUP_PHOTOS = 5;
/** Longest side after shrinking, and the quality it is saved at: a room photo comes out around 200 to 500 KB. */
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;
/** Photos bigger than this (before shrinking) are refused. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Shrinks a photo (longest side 1600px, JPEG) so it is cheap to upload, store and send to painters. */
export async function compressImage(file: File): Promise<File> {
  if (file.size > MAX_INPUT_BYTES) throw new Error('too large');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  let quality = JPEG_QUALITY;
  let blob: Blob | null = null;
  for (let i = 0; i < 3; i++) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= 900 * 1024) break;
    quality -= 0.15;
  }
  if (!blob) throw new Error('could not shrink');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}
`],
]);

// ---- engine: several photos at once, and the new wrap-up wording
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["export interface PhotoAssessment {", `/** Several photos attached at once from the popup (they count as the pictures of the property). */
export function applyUploadedPhotos(
  state: ChatState,
  photos: { url: string; description: string }[],
): ChatState {
  const photoRequests = state.ctx.photoRequests.map((r) => (r.id === 'property' ? { ...r, fulfilled: true } : r));
  const stamp = Date.now();
  const added = photos.map((p, i) => ({ id: \`property-\${stamp}-\${i}\`, url: p.url, description: p.description, label: 'the property' }));
  return {
    ...state,
    ctx: { ...state.ctx, photoRequests, photos: [...state.ctx.photos, ...added] },
    history: [
      ...state.history,
      botMessage(photos.length === 1 ? 'Got the photo, thanks, that helps a lot.' : \`Got \${photos.length} photos, thanks, that helps a lot.\`),
    ],
  };
}

export interface PhotoAssessment {`],
  ["      const propertyMarker = alreadyAskedForProperty ? '' : '[[photo:property|the property]] ';\n", "      const propertyMarker = alreadyAskedForProperty ? '' : '[[photos|attach photo]] ';\n"],
  ["`I think I've got enough to put a number together. ${reminderLeadIn}${reminderMarkers}${reminderMarkers ? ' ' : ''}${propertyMarker}A couple of photos of the property help painters respond faster and with more confidence, so feel free to attach some. ` +", "`I think I've got enough to put a number together. ${reminderLeadIn}${reminderMarkers}${reminderMarkers ? ' ' : ''}A couple of photos of the property help painters respond faster and with more confidence, please attach some here. ${propertyMarker}` +"],
]);

// ---- panel: the new popup + the paperclip link
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["import { uploadQuotePhoto, analyzeQuotePhoto } from '../../lib/chatEstimator/photoUpload';", "import { uploadQuotePhoto, analyzeQuotePhoto } from '../../lib/chatEstimator/photoUpload';\nimport PhotoPopup from './PhotoPopup';"],
  ["  function handlePhotoLinkClick(id: string, label: string) {", `  // the "attach photo" link: up to five photos at once
  const [photoPopupOpen, setPhotoPopupOpen] = useState(false);

  async function submitPhotoPopup(photos: { file: File; caption: string }[]) {
    const uploaded: { url: string; description: string }[] = [];
    for (const p of photos) {
      const url = await uploadQuotePhoto(p.file);
      uploaded.push({ url, description: p.caption || 'Photo of the property' });
    }
    setState((prev) => applyUploadedPhotos(prev, uploaded));
    setPhotoPopupOpen(false);
    // best-effort read of the first photo only (each read costs a vision call)
    const first = uploaded[0];
    analyzeQuotePhoto(first.url, first.description, 'the property').then((assessment) => {
      if (assessment) setState((prev) => applyPhotoAssessment(prev, 'property', assessment));
    });
  }

  function handlePhotoLinkClick(id: string, label: string) {
    if (id === 'photos') {
      setPhotoPopupOpen(true);
      return;
    }`],
  ["      {pendingPhotoFile && pendingPhotoRequest && (", "      {photoPopupOpen && <PhotoPopup onClose={() => setPhotoPopupOpen(false)} onSubmit={submitPhotoPopup} />}\n\n      {pendingPhotoFile && pendingPhotoRequest && ("],
  ["  const parts = text.split(/(\\*\\*[^*]+\\*\\*|\\[\\[photo:[^|]+\\|[^\\]]+\\]\\])/g);", "  const parts = text.split(/(\\*\\*[^*]+\\*\\*|\\[\\[photo:[^|]+\\|[^\\]]+\\]\\]|\\[\\[photos\\|[^\\]]+\\]\\])/g);"],
  ["    const photo = p.match(/^\\[\\[photo:([^|]+)\\|([^\\]]+)\\]\\]$/);", "    const attach = p.match(/^\\[\\[photos\\|([^\\]]+)\\]\\]$/);\n    if (attach) {\n      return (\n        <button key={i} type=\"button\" className=\"chat-photo-link\" onClick={() => onPhotoRequest('photos', attach[1])}>\n          {'\\u{1F4CE}'} {attach[1].charAt(0).toUpperCase() + attach[1].slice(1)}\n        </button>\n      );\n    }\n    const photo = p.match(/^\\[\\[photo:([^|]+)\\|([^\\]]+)\\]\\]$/);"],
]);
console.log('patched');
