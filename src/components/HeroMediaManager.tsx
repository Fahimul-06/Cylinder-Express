import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Video,
  Upload,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  Eye,
  EyeOff,
  GripVertical,
  AlertCircle,
} from "lucide-react";
import { supabase, uploadFile, deleteFile } from "../lib/supabase";
import type { HeroMedia } from "../lib/supabase";

type FormState = {
  title: string;
  media_url: string;
  media_type: "image" | "video";
  display_order: number;
  is_active: boolean;
};

const emptyForm: FormState = {
  title: "",
  media_url: "",
  media_type: "image",
  display_order: 0,
  is_active: true,
};


const HERO_IMAGE_MAX_WIDTH = 1920;
const HERO_IMAGE_MAX_HEIGHT = 1080;
const HERO_IMAGE_QUALITY = 0.9;

async function resizeHeroImageForUpload(file: File): Promise<File> {
  // Keep animated GIFs untouched so animation is not lost.
  if (file.type === "image/gif") return file;

  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    HERO_IMAGE_MAX_WIDTH / imageBitmap.width,
    HERO_IMAGE_MAX_HEIGHT / imageBitmap.height,
  );

  const targetWidth = Math.max(1, Math.round(imageBitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", HERO_IMAGE_QUALITY),
  );

  if (!blob) return file;

  const originalName = file.name.replace(/\.[^/.]+$/, "");
  return new File([blob], `${originalName}-hero.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

function fittedHeroImage(src: string, alt: string, className = "h-48") {
  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
      />
      <img
        src={src}
        alt={alt}
        className="relative z-10 h-full w-full object-contain object-center"
      />
    </div>
  );
}

function isVideoUrl(url: string) {
  return (
    /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url) ||
    /(youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com)/i.test(url)
  );
}

function detectMediaType(
  url: string,
  fallback: "image" | "video" = "image",
): "image" | "video" {
  if (isVideoUrl(url)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/i.test(url)) return "image";
  return fallback;
}

function getVideoEmbedUrl(url: string) {
  if (!url) return "";

  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=0&mute=1&controls=1&playsinline=1`
        : "";
    }

    if (host.includes("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ||
        parsed.pathname.split("/").filter(Boolean).pop();
      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=0&mute=1&controls=1&playsinline=1`
        : "";
    }

    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id
        ? `https://player.vimeo.com/video/${id}?autoplay=0&muted=1&loop=1&playsinline=1`
        : "";
    }

    if (host.includes("drive.google.com")) {
      const match = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
      const id = match?.[1];
      return id ? `https://drive.google.com/file/d/${id}/preview` : "";
    }
  } catch {
    return "";
  }

  return "";
}

function mediaPreview(item: {
  media_url: string;
  media_type: "image" | "video";
  title?: string;
}) {
  if (!item.media_url) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/60 text-slate-500">
        No media selected
      </div>
    );
  }

  const shouldRenderVideo =
    item.media_type === "video" || isVideoUrl(item.media_url);
  const embedUrl = shouldRenderVideo ? getVideoEmbedUrl(item.media_url) : "";

  if (shouldRenderVideo && embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={item.title || "Hero video preview"}
        className="h-48 w-full rounded-xl border border-slate-700 bg-black"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    );
  }

  if (shouldRenderVideo) {
    return (
      <video
        className="h-48 w-full rounded-xl border border-slate-700 bg-black object-cover"
        muted
        loop
        controls
        playsInline
        preload="metadata"
      >
        <source src={item.media_url} />
        Your browser does not support this video.
      </video>
    );
  }

  return fittedHeroImage(item.media_url, item.title || "Hero media");
}

export function HeroMediaManager() {
  const [items, setItems] = useState<HeroMedia[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hero_media")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) setError(error.message);
    if (data) setItems(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ ...emptyForm, display_order: items.length + 1 });
    setEditingId(null);
    setError("");
  };

  const handleFileUpload = async (file: File) => {
    setError("");
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Please upload an image or video file.");
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Media file must be 100MB or smaller.");
      return;
    }

    setUploading(true);
    if (form.media_url && form.media_url.startsWith("/uploads/")) {
      await deleteFile(form.media_url);
    }

    let uploadTarget = file;
    if (isImage) {
      try {
        uploadTarget = await resizeHeroImageForUpload(file);
      } catch {
        uploadTarget = file;
      }
    }

    const url = await uploadFile(uploadTarget, "hero-media");
    setUploading(false);

    if (!url) {
      setError("Upload failed. Please try again.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      media_url: url,
      media_type: isVideo ? "video" : "image",
      title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.media_url) {
      setError("Please upload or enter a media URL.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      media_type: detectMediaType(form.media_url, form.media_type),
      display_order: Number(form.display_order) || 0,
    };

    const result = editingId
      ? await supabase.from("hero_media").update(payload).eq("id", editingId)
      : await supabase.from("hero_media").insert(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await fetchItems();
    setForm({ ...emptyForm, display_order: items.length + 2 });
    setEditingId(null);
  };

  const handleEdit = (item: HeroMedia) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      media_url: item.media_url,
      media_type: item.media_type,
      display_order: item.display_order,
      is_active: item.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (item: HeroMedia) => {
    if (!confirm("Delete this hero media item?")) return;
    const result = await supabase.from("hero_media").delete().eq("id", item.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (item.media_url.startsWith("/uploads/"))
      await deleteFile(item.media_url);
    await fetchItems();
  };

  const toggleActive = async (item: HeroMedia) => {
    const result = await supabase
      .from("hero_media")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (result.error) setError(result.error.message);
    await fetchItems();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-100">Hero Media</h1>
        <p className="mt-2 text-gray-400">
          Upload photos and videos for the homepage hero. The public hero
          section shows only these media items.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              {editingId ? "Edit Hero Media" : "Add Hero Media"}
            </h2>
            <p className="text-sm text-gray-500">
              Images are automatically resized and fitted to the hero box. Videos: MP4, WebM, OGG. Max 100MB.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-gray-300 hover:bg-slate-700"
            >
              <X size={16} /> Cancel
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Title / label
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 outline-none focus:border-amber-500"
                placeholder="Hero slide 1"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Media URL
              </label>
              <input
                value={form.media_url}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    media_url: e.target.value,
                    media_type: detectMediaType(
                      e.target.value,
                      prev.media_type,
                    ),
                  }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 outline-none focus:border-amber-500"
                placeholder="Upload file or paste image/video URL"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Type
                </label>
                <select
                  value={form.media_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      media_type: e.target.value as "image" | "video",
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 outline-none focus:border-amber-500"
                >
                  <option value="image">Photo</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Order
                </label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      display_order: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, is_active: !prev.is_active }))
                  }
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                    form.is_active
                      ? "border-green-500/40 bg-green-500/10 text-green-300"
                      : "border-slate-700 bg-slate-800 text-gray-400"
                  }`}
                >
                  {form.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  {form.is_active ? "Active" : "Hidden"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/ogg,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 font-medium text-gray-200 hover:bg-slate-700 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Upload size={18} />
                )}
                {uploading ? "Resizing & Uploading..." : "Upload Photo/Video"}
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 font-semibold text-slate-950 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : editingId ? (
                  <Save size={18} />
                ) : (
                  <Plus size={18} />
                )}
                {editingId ? "Save Changes" : "Add Media"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Preview
            </label>
            {mediaPreview(form)}
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">
            Hero Media List
          </h2>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-gray-400">
            {items.length} items
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-amber-400" size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-gray-500">
            No hero media added yet.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70"
              >
                <div className="relative">
                  {item.media_type === "video" ? (
                    <video
                      src={item.media_url}
                      className="h-48 w-full bg-black object-cover"
                      muted
                      loop
                      playsInline
                      controls
                    />
                  ) : (
                    <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                      <img
                        src={item.media_url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
                      />
                      <img
                        src={item.media_url}
                        alt={item.title || "Hero media"}
                        className="relative z-10 h-full w-full object-contain object-center"
                      />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    {item.media_type === "video" ? (
                      <Video size={14} />
                    ) : (
                      <ImageIcon size={14} />
                    )}
                    {item.media_type === "video" ? "Video" : "Photo"}
                  </div>
                  <div
                    className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-medium ${item.is_active ? "bg-green-500 text-slate-950" : "bg-slate-700 text-gray-300"}`}
                  >
                    {item.is_active ? "Active" : "Hidden"}
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <GripVertical size={18} className="mt-1 text-slate-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-100">
                        {item.title || "Untitled media"}
                      </p>
                      <p className="text-sm text-gray-500">
                        Display order: {item.display_order}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-gray-300 hover:bg-slate-700"
                    >
                      {item.is_active ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/25"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="flex items-center justify-center gap-1 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 hover:bg-red-500/25"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
