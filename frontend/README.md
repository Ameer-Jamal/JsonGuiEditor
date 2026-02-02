# JSON GUI Editor

A flexible visual editor for **any nested JSON**. Import JSON or Excel, browse it in a tree, edit values and types, and define a **profile** that explains how your JSON should be grouped (tabs → sections → fields, or any other hierarchy). Profiles are saved as sidecar `*.layout.json` files you can reuse.

## What This App Solves

- Make complex JSON **human-friendly** without losing structure.
- Create **custom layouts** for different JSON shapes (forms, school data, configs, etc.).
- Reuse the same profile on future imports so teams see consistent grouping.

## Key Features

### JSON + Excel Import
- Import any `.json` file or Excel sheet.
- Excel data imports as a JSON array.
- Toast messages confirm import success or failure.

### Tree + Inspector Editing
- Select any node to edit keys, types, values, enums.
- Edit **Debug JSON** for a single node (apply updates to the tree).
- Edit **Raw JSON** to replace the whole document.

### Profile-Based Layouts (Hybrid Mapping)
Profiles define the **semantic schema** of your JSON:
- **Level 1**: Top group (Tabs / Schools / Categories)
- **Level 2**: Mid group (Sections / Classes / Items)
- **Level 3**: Fields (Fields / Students / Properties)

Each level has:
- **Path** (e.g., `tabs[*]`)
- **Label key** (e.g., `name`)
- **Filter key/values** (e.g., `type=SECTION`)
- **Override paths** for edge cases

The Preview uses these rules to render a layout even when raw JSON is messy.

## Quick Start

1. **Run the app**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open the port Vite prints (usually `http://localhost:5173`).

2. **Import JSON**
   - Click **Import JSON** or **Import Excel** in the sidebar.

3. **Create a Profile**
   - Open **Profile Wizard**.
   - Define Level 1 / 2 / 3 paths and filters.
   - Add field attributes you want to display (e.g., `name,width,type`).

4. **Switch to Profile Mode**
   - Set **Layout Mode → Profile**.
   - Preview now renders tabs/sections/fields from your profile rules.

5. **Save the Profile**
   - Export profile to a `*.layout.json` file for reuse later.

## Example Profile (Form Layout JSON)

```
Level 1 (Tabs): tabs[*], labelKey=name, filterKey=type, filterValues=TAB
Level 2 (Sections): contents.rows[*].contents[*], labelKey=name, filterKey=type, filterValues=SECTION,SUBFORM
Level 3 (Fields): contents.rows[*].contents[*], labelKey=name, filterKey=type, filterValues=FIELD
Field Attributes: name,width,offset,type,rule
```

## Tips
- Use **Auto mode** to see the raw JSON structure.
- Use **Profile mode** when you want a clean, user-friendly layout.
- Save profile files per JSON type so your team can reuse layouts.
