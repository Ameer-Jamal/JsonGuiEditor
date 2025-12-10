<img width="3410" alt="JSON Form Layout Editor Screenshot" src="https://github.com/user-attachments/assets/32dfb432-bcab-48fb-b088-c3cdb95ddf9d" />

# JSON Form Layout Editor

A powerful, visual GUI application designed for creating, editing, and managing Reliance Form Layout definitions. This tool bridges the gap between complex JSON structures and user-friendly visual design, allowing developers and administrators to build forms intuitively.

## 🚀 Features

### 🎨 Visual Form Builder
*   **Drag-and-Drop Interface**: Easily reorder Tabs, Sections, and Fields. Move items seamlessly between containers (e.g., drag a Field from one Section to another).
*   **Hierarchical Tree View**: A clean, nested sidebar allows for precise navigation and structure management.
*   **Real-Time Preview**: The center canvas renders a live preview of the form, displaying actual input controls (Date pickers, Text areas, etc.) based on field names and types.

### ⚡ Smart Import & Export
*   **Excel Import**: Rapidly migrate existing field definitions. The importer supports column mapping and automatic filtering of empty rows.
*   **Clean JSON Export**: Export your work as a standardized JSON file. The built-in cleaner automatically strips internal application IDs, ensuring the output is production-ready.
*   **One-Click Copy**: Quickly copy the clean JSON structure to your clipboard for debugging or committing to version control.

### 🛠 Powerful Inspector
*   **Property Editing**: click any element to inspect and modify its properties (Name, Width, Offset, Type, etc.).
*   **Debug View**: Inspect the raw JSON of the selected node in real-time.

### 💻 Modern UI/UX
*   **Resizable Panels**: Customize your workspace by resizing the Sidebar and Inspector panes.
*   **Glassmorphism Design**: A modern, clean aesthetic using Tailwind CSS and Framer Motion animation.

## 🛠️ Technology Stack

*   **Framework**: React 19 + Vite
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS 4
*   **State Management**: React Context API
*   **Drag & Drop**: @dnd-kit/core & @dnd-kit/sortable
*   **Data Processing**: SheetJS (xlsx) for Excel import

## 📦 Installation & Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/json-gui-editor.git
    cd json-gui-editor
    ```

2.  **Navigate to the frontend directory**:
    ```bash
    cd frontend
    ```

3.  **Install dependencies**:
    ```bash
    npm install
    ```

4.  **Run the development server**:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

## 📖 Usage Guide

*   **Adding Items**: Right-click on any node in the Sidebar to add a child element (e.g., right-click a Tab to add a Section).
*   **Moving Items**: Drag items in the Sidebar to reorder them or move them to different parents.
*   **Editing Properties**: Select an item and use the right-hand Inspector panel to change names, widths, or other attributes.
*   **Importing**: Click the "Import Excel" button in the Sidebar to upload a `.xlsx` file and map its columns.
*   **Exporting**: Use the "Export File" or "Copy JSON" buttons in the top header to get your final JSON output.
