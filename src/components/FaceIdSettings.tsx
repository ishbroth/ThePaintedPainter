import { useEffect, useState } from 'react';
import { faceIdName, forgetFaceId, savedFaceIds } from '../lib/faceid';

/** In the app: a line to forget the sign-ins saved behind Face ID on this phone (shown only when there are any). */
export default function FaceIdSettings() {
  const [count, setCount] = useState(savedFaceIds().length);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => { void faceIdName().then(setName); }, []);
  if (!name || count === 0) return null;
  return (
    <p className="mb-3 text-center text-xs text-[var(--text-secondary)]">
      {name} sign-in is on for this phone ({count} account{count === 1 ? '' : 's'}).{' '}
      <button type="button" className="underline" onClick={() => void forgetFaceId().then(() => setCount(0))}>Forget it</button>
    </p>
  );
}
