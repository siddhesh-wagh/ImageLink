# 🖼 PixelVault

> A smart, zero-dependency image uploader with cloud hosting via ImgBB and a full offline-first local storage fallback — all in a single HTML file or as a clean 3-file project.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![No Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=flat)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## ✨ Features

| Feature | Description |
|---|---|
| ☁ **Cloud Upload** | Upload images to [ImgBB](https://imgbb.com) and get a permanent shareable URL |
| 💾 **Local Fallback** | Save images to browser IndexedDB — works 100% offline, no API key needed |
| 📋 **Multi-format Copy** | Instantly copy as URL, Markdown, HTML `<img>`, BBCode, or RST |
| 🖼 **Gallery** | Browse all past uploads with search, filter (cloud/local), and thumbnails |
| 📊 **Live Dashboard** | Stats bar showing cloud count, local count, and total storage used |
| 🔍 **Image Preview** | See filename, size, MIME type, and pixel dimensions before uploading |
| ⏱ **Expiry Control** | Set cloud images to auto-delete after 10 min, 1 hour, 1 day, 1 week, or 1 month |
| 🗑 **Delete & Export** | Remove individual images or export your full gallery as JSON |
| 📌 **Paste Support** | Paste images directly from clipboard with `Ctrl+V` |
| 🔑 **Key Persistence** | API key is remembered in `localStorage` across sessions |

---

## 🚀 Quick Start

### Option A — Single file (easiest)

No setup required. Just open the file in any browser.

```bash
# Clone the repo
git clone https://github.com/siddhesh-wagh/ImageLink.git
cd pixelvault

# Open directly in browser
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

### Option B — 3-file project with Live Server

```bash
git clone https://github.com/siddhesh-wagh/ImageLink.git
cd pixelvault

# Open in VS Code
code .

# Right-click index.html → Open with Live Server
# Make sure all 3 files are in the same folder:
# ├── index.html
# ├── style.css
# └── app.js
```

> ⚠️ **Important:** If using Live Server or any local server, all three files (`index.html`, `style.css`, `app.js`) must be in the **same directory**. The 404 / MIME type errors are caused by mismatched file locations.

---

## 🔑 Getting an ImgBB API Key (Free)

1. Go to [https://api.imgbb.com](https://api.imgbb.com)
2. Sign up for a free account
3. Copy your API key from the dashboard
4. Paste it into the **API Key** field in PixelVault

Your key is automatically saved to `localStorage` so you only need to enter it once.

---

## 🗂 Project Structure

```
pixelvault/
├── index.html      # Main UI — all markup and structure
├── style.css       # Dark premium theme, animations, responsive layout
├── app.js          # All logic: IndexedDB, ImgBB API, gallery, clipboard
└── README.md
```

### How the code is organized

**`index.html`** — Pure structure. Contains the drop zone, tabs, options row, preview panel, result card, gallery grid, modal, and toast container. No inline styles or scripts.

**`style.css`** — CSS custom properties for theming, animated background grid, drop zone hover states, progress bar, gallery grid, modal, toast animations, and full mobile responsiveness.

**`app.js`** — Split into clear sections:
- IndexedDB helpers (`initDB`, `dbAll`, `dbPut`, `dbDel`)
- File handling (`pickFile`, `toB64`, `getDims`)
- Cloud upload (`uploadCloud` → ImgBB API)
- Local save (`uploadLocal` → IndexedDB)
- Gallery render + search/filter
- Copy, download, export utilities
- Toast notification system
- Modal lightbox

---

## 🔄 How Cloud vs Local Mode Works

```
User drops image
       │
       ▼
  ┌─────────────────────────────────┐
  │  Which tab is selected?         │
  └─────────────────────────────────┘
       │                    │
  ☁ Cloud              💾 Local
       │                    │
       ▼                    ▼
  ImgBB API           IndexedDB
  (needs key)         (no internet)
       │                    │
       ▼                    ▼
  Public URL          Data URL (base64)
  shareable anywhere  device-only
       │                    │
       └─────────┬──────────┘
                 ▼
          Gallery + Stats updated
          Multi-format copy available
```

### When to use each mode

| Situation | Recommended Mode |
|---|---|
| Sharing images on the web | ☁ Cloud (ImgBB) |
| No internet connection | 💾 Local |
| ImgBB API down or key missing | 💾 Local |
| Temporary images (auto-delete) | ☁ Cloud with expiry set |
| Private images, never leave device | 💾 Local |

---

## 📋 Copy Formats Explained

After every upload, PixelVault shows quick-copy chips for all common formats:

| Format | Example output |
|---|---|
| **URL** | `https://i.ibb.co/abc123/image.png` |
| **Markdown** | `![my-image](https://i.ibb.co/abc123/image.png)` |
| **HTML** | `<img src="https://i.ibb.co/abc123/image.png" alt="my-image" />` |
| **BBCode** | `[img]https://i.ibb.co/abc123/image.png[/img]` |
| **RST** | `.. image:: https://i.ibb.co/abc123/image.png` |

---

## 💾 Local Storage — Technical Details

Local mode uses the browser's **IndexedDB** API, not `localStorage`. This means:

- **Storage limit:** typically 50–80% of available disk space (much larger than localStorage's 5MB)
- **Persistence:** data survives browser restarts and is not cleared by normal cache clearing (requires explicit "clear site data")
- **Privacy:** base64 image data never leaves your device
- **Portability:** use the **Export** button to download a JSON manifest of all your uploads

> Note: Local images are stored as full base64 data URLs. Very large images (10MB+) may be slow to store/retrieve depending on your device.

---

## 🖥 Browser Support

| Browser | Cloud Upload | Local Storage |
|---|---|---|
| Chrome 90+ | ✅ | ✅ |
| Firefox 88+ | ✅ | ✅ |
| Safari 15+ | ✅ | ✅ |
| Edge 90+ | ✅ | ✅ |

Requires: `fetch`, `IndexedDB`, `FileReader`, `navigator.clipboard` (with HTTPS or localhost for clipboard).

---

## 🛠 Common Issues & Fixes

### `app.js` not found (404) / MIME type error
**Cause:** Files are in different folders, or you opened `index.html` from the outputs subfolder while `app.js` is elsewhere.
**Fix:** Put `index.html`, `style.css`, and `app.js` in the same folder and open `index.html` from there.

### Upload fails / API error
**Cause:** Invalid or expired ImgBB API key, or ImgBB is temporarily down.
**Fix:** Switch to **Local Storage** tab — it works with zero internet and no API key.

### Clipboard paste not working
**Cause:** Browser requires a secure context (HTTPS or localhost) for clipboard access.
**Fix:** Use Live Server (`localhost`) or serve via HTTPS. Direct `file://` opens may block clipboard.

### Images not persisting after browser restart
**Cause:** Browser is set to clear site data on exit, which wipes IndexedDB.
**Fix:** Check your browser's privacy settings → "Clear browsing data on exit" and exclude site data, or use the **Export** button to save a JSON backup before closing.

---

## 📄 License

MIT — free to use, modify, and distribute. See [LICENSE](LICENSE) for details.

---

## 🙌 Acknowledgements

- [ImgBB API](https://api.imgbb.com) — free image hosting
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — browser-native key-value storage
- Built with zero external dependencies — pure HTML, CSS, and vanilla JavaScript
