import { useState, useRef } from 'react';

interface PortfolioImage {
  id: number;
  url: string;
  caption: string;
}

const initialImages: PortfolioImage[] = [
  { id: 1, url: '/thumbnail_IMG_3202.jpg', caption: 'Exterior repaint - Victorian home' },
  { id: 2, url: '/thumbnail_IMG_8544.jpg', caption: 'Interior living room makeover' },
  { id: 3, url: '/thumbnail_IMG_3262.jpg', caption: 'Commercial office repaint' },
  { id: 4, url: '/thumbnail_IMG_7611.jpg', caption: 'Kitchen cabinet refinishing' },
  { id: 5, url: '/thumbnail_IMG_8748.jpg', caption: 'Accent wall feature design' },
  { id: 6, url: '/thumbnail_IMG_9403.jpg', caption: 'Full exterior - ranch style' },
];

export default function PainterPortfolio() {
  const [images, setImages] = useState<PortfolioImage[]>(initialImages);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = (id: number) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    showToast('Image removed from portfolio.');
  };

  const handleUploadClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = () => {
    showToast('Upload functionality coming soon');
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const startEdit = (img: PortfolioImage) => {
    setEditingId(img.id);
    setEditCaption(img.caption);
  };

  const saveCaption = (id: number) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption: editCaption } : img))
    );
    setEditingId(null);
    showToast('Caption updated.');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-gray-400 text-sm mt-1">Showcase your best work to attract customers.</p>
        </div>
        <button
          onClick={handleUploadClick}
          className="px-5 py-2.5 bg-[#f5a623] hover:bg-[#e09500] text-black font-semibold rounded-lg transition-colors text-sm"
        >
          + Upload Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {toast && (
        <div className="bg-[#222] border border-[#f5a623] text-[#f5a623] px-4 py-3 rounded-lg mb-6 text-sm">
          {toast}
        </div>
      )}

      {images.length === 0 ? (
        <div className="bg-[#222] border border-[#333] rounded-xl p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No portfolio images yet</p>
          <p className="text-gray-500 text-sm">Upload images of your completed projects to build your portfolio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img) => (
            <div key={img.id} className="bg-[#222] border border-[#333] rounded-xl overflow-hidden group">
              <div className="relative">
                <img
                  src={img.url}
                  alt={img.caption}
                  className="w-full h-48 object-cover"
                />
                <button
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                  title="Delete image"
                >
                  {'\u2715'}
                </button>
              </div>
              <div className="p-3">
                {editingId === img.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#555] rounded text-white text-sm focus:outline-none focus:border-[#f5a623]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveCaption(img.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => saveCaption(img.id)}
                      className="px-3 py-1 bg-[#f5a623] text-black text-sm rounded font-semibold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <p
                    className="text-sm text-gray-300 cursor-pointer hover:text-[#f5a623] transition-colors"
                    onClick={() => startEdit(img)}
                    title="Click to edit caption"
                  >
                    {img.caption}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
