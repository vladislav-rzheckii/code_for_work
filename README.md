# HTML - Markdown Online Editor

Web editor for preparing content in two formats: **Visual + HTML/Markdown**.  
The application helps edit text in a WYSIWYG interface, instantly view source output, and export clean code for publishing.

## Live Service

Try the service here: [HTML - Markdown Online Editor](https://html-markdown-online-editor.vercel.app/)

## How the Application Works

- **Left panel (`Visual editor`)**: rich-text editing with toolbar controls.
- **Right panel (`HTML` / `Markdown`)**: editable source view with syntax highlighting.
- **Mode switch (`HTML` / `Markdown`)**: changes right panel output format.
- **`Apply to Visual`**: applies right-panel edits back into the visual editor.
- **`Copy`**: copies current output (clean HTML in HTML mode, plain Markdown in Markdown mode).

## Main Features

- Visual text editing (bold, italic, strike, headings H1-H4, paragraph, quote).
- Bullet and ordered lists.
- Table creation and editing (insert table, add row/column, delete table).
- Link insertion and link preview editor (anchor/URL update + copy URL).
- HTML cleanup and normalized output.
- Markdown support with correct heading and table formatting.
- Syntax-highlighted editable code pane (HTML and Markdown).
- Light/Dark theme toggle.
- Sticky top controls for convenient long-text editing.

## Project Structure

- `html-markdown-editor/` — Next.js application source.
- `html-markdown-editor/app/page.tsx` — editor logic and UI.
- `html-markdown-editor/app/globals.css` — global styles and theme setup.
- `html-markdown-editor/app/layout.tsx` — metadata and app layout.

## Run Locally

From repository root:

```bash
cd html-markdown-editor
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).