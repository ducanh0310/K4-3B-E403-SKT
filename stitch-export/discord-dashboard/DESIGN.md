---
name: Discord Operations Command
colors:
  surface: '#12131c'
  surface-dim: '#12131c'
  surface-bright: '#383843'
  surface-container-lowest: '#0c0e17'
  surface-container-low: '#1a1b25'
  surface-container: '#1e1f29'
  surface-container-high: '#282934'
  surface-container-highest: '#33343f'
  on-surface: '#e2e1ef'
  on-surface-variant: '#c6c5d7'
  inverse-surface: '#e2e1ef'
  inverse-on-surface: '#2f303a'
  outline: '#8f8fa0'
  outline-variant: '#454655'
  surface-tint: '#bec2ff'
  primary: '#bec2ff'
  on-primary: '#000da4'
  primary-container: '#5865f2'
  on-primary-container: '#fffdff'
  inverse-primary: '#3f4cda'
  secondary: '#43e179'
  on-secondary: '#003917'
  secondary-container: '#04c25e'
  on-secondary-container: '#00481e'
  tertiary: '#ddc73f'
  on-tertiary: '#383000'
  tertiary-container: '#c0ac23'
  on-tertiary-container: '#494000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bec2ff'
  on-primary-fixed: '#000569'
  on-primary-fixed-variant: '#222fc2'
  secondary-fixed: '#65ff92'
  secondary-fixed-dim: '#43e179'
  on-secondary-fixed: '#00210a'
  on-secondary-fixed-variant: '#005224'
  tertiary-fixed: '#fae359'
  tertiary-fixed-dim: '#ddc73f'
  on-tertiary-fixed: '#201c00'
  on-tertiary-fixed-variant: '#514700'
  background: '#12131c'
  on-background: '#e2e1ef'
  surface-variant: '#33343f'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
  tag:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-density, command-center aesthetic tailored for course teaching assistants, professors, and automated moderation pipelines. Drawing primary cues from Discord’s desktop client interface and modern developer tooling, the aesthetic combines a midnight dark-mode palette with focused structural precision.

The tone is responsive, focused, and operationally rigorous. Visual noise is minimized to allow teaching assistants to triage incoming student inquiries, monitor AI auto-responses, review clustered inquiry trends, and address escalated academic roadblocks without cognitive fatigue. The visual language blends deep slate paneling, crisp hairline separations, subtle translucent backdrops for fixed controls, and electric blurple highlights.

## Colors

The color palette is engineered specifically for prolonged, late-night dashboard use. Deep midnight bases avoid OLED pitch-black starkness in favor of rich, layered blue-grays.

### Core Swatches
- **Canvas Base**: `#0E1015` (deep midnight) serves as the base layer under split panels and navigation channels.
- **Surface Elevation 1 (Cards & Sidebars)**: `#181920` (muted charcoal slate).
- **Surface Elevation 2 (Elevated Cards & Popovers)**: `#1E1F29` (dark slate surface).
- **Surface Elevation 3 (Active Item / Hover States)**: `#2B2D38` (border and interactive hover surface).
- **Hairline Borders**: `#2B2D38` (subtle partition lines).

### Accent & Semantic Roles
- **Primary Brand Blurple**: `#5865F2` (standard interactive controls, primary badges, focused borders).
  - Hover: `#7983F5`
  - Active / Pressed: `#4752C4`
  - Translucent Glow: `rgba(88, 101, 242, 0.15)`
- **Success / Resolved**: `#57F287` (emerald green for verified answers, resolved tickets, operational bots).
  - Surface Tint: `rgba(87, 242, 135, 0.12)`
- **Warning / Pending Review**: `#FEE75C` (vibrant amber-gold for unresolved AI clusters, pending student escalations).
  - Surface Tint: `rgba(254, 231, 92, 0.12)`
- **Critical / Needs Action**: `#ED4245` (rose red for SLA breaches, flagged academic integrity alerts, down services).
  - Surface Tint: `rgba(237, 66, 69, 0.14)`

### Text & Icons
- **Text High-Contrast (Primary)**: `#F2F3F5`
- **Text Medium-Contrast (Secondary / Metadata)**: `#949BA4`
- **Text Low-Contrast (Muted / Placeholders)**: `#5C5E66`

## Typography

The type system prioritizes compact information density, scannability, and high-contrast readability.

- **Primary Typeface (`Inter`)**: Used across headlines, descriptive body copy, ticket threads, and navigation elements. Feature flags: enable tabular numbers (`tnum`) for consistent countdowns, queues, and student reply counts.
- **Monospace Accent (`JetBrains Mono`)**: Reserved for machine-facing elements: Discord IDs, code snippets, ticket hashes, AI confidence scores, timestamps, and bot command triggers.

### Hierarchy Guidelines
1. **Thread Headers**: Use `headline-sm` with semibold weight and `#F2F3F5` coloring to keep student posts distinct from replies.
2. **Metadata & Labels**: Render timestamps, channel names (e.g., `#cs106b-help`), and role tags in `label-sm` with `JetBrains Mono` to establish clear contextual separation.
3. **Truncation & Multiline**: Long student queries in summary queues clamp at 2 lines using `body-md`.

## Layout & Spacing

The dashboard uses a structured multi-pane app layout modeled after operational productivity environments:

1. **Left Activity Rail (64px fixed)**: Course switchers, global bot status, and notifications.
2. **Navigation Sidebar (240px fixed)**: Channels, AI clustering queues, active SLA monitors, and TA shifts.
3. **Primary Content Work Area (Fluid)**: Split grid view featuring live question feeds, response panels, and context sidebars.

### Grid & Density Rules
- **Desktop (1280px+)**: Multi-column master-detail layout. The list queue occupies 380px fixed width, while the active ticket/thread detail pane expands flexibly to fill the rest of the canvas.
- **Tablet (768px - 1279px)**: Activity rail collapses into an icon ribbon; navigation sidebar becomes an off-canvas drawer. Master-detail switches to a toggleable split view.
- **Mobile (< 768px)**: Strict single-panel stack. The navigation, question stream, and response workspace become separate full-screen views with a persistent bottom quick-action bar.
- **Micro Spacing**: Use `space-xs` (4px) and `space-sm` (8px) for tightly grouped controls inside ticket rows, avatar groups, and badge clusters.

## Elevation & Depth

Depth is established through dark-surface layering and subtle hairline boundaries rather than dramatic dropped shadows.

### Elevation Hierarchy
- **Level 0 (Background Canvas)**: `#0E1015`, no shadow.
- **Level 1 (Structural Containers & Sidebars)**: `#181920`, 1px solid `#2B2D38`.
- **Level 2 (Interactive Cards & Module Tiles)**: `#1E1F29`, 1px solid `#2B2D38`. Hover transitions shift background to `#242633` and border to `#383A48`.
- **Level 3 (Modals, Context Menus, and Floating Action Bars)**: `#1E1F29`, 1px solid `#3E4152`, supported by an ambient drop shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.65), 0 2px 6px -1px rgba(0, 0, 0, 0.4)`.

### Glassmorphic Translucency
Top headers, breadcrumbs, and floating response bars employ glassmorphism:
- Background: `rgba(14, 16, 21, 0.8)`
- Backdrop Filter: `blur(12px)`
- Border Bottom: `1px solid rgba(43, 45, 56, 0.8)`

## Shapes

The design uses balanced, modern rounded geometries to soften structural density without wasting horizontal screen area.

- **Base Corner Radius (`rounded-md` / 8px)**: Standard for inner form fields, code blocks, tab items, and dropdown entries.
- **Card & Container Radius (`rounded-xl` / 16px)**: Used for high-level cards, ticket grouping clusters, modal dialogs, and main pane corners.
- **Pill Radius (`rounded-full`)**: Applied strictly to status indicator dots, numerical notification counts, user presence rings, and tag badges.
- **Avatars**: 12px squircle radius (`rounded-lg`) for Discord-authentic user and bot avatar presentation.

## Components

### Buttons
- **Primary**: Background `#5865F2`, text `#FFFFFF`, radius 8px, hover `#7983F5`, active `#4752C4`. Focused ring: `0 0 0 2px #0E1015, 0 0 0 4px #5865F2`.
- **Secondary / Ghost**: Background `transparent`, border `1px solid #2B2D38`, text `#F2F3F5`. Hover background `#2B2D38`.
- **Destructive**: Background `rgba(237, 66, 69, 0.15)`, text `#ED4245`, border `1px solid rgba(237, 66, 69, 0.3)`. Hover background `#ED4245`, text `#FFFFFF`.
- **Compact Action**: Height 28px, padding `0 8px`, typography `label-sm`. Used in table actions and quick triage.

### Status Badges & Chips
- Status chips feature a filled pill dot (6px) next to uppercase mono labels (`label-sm`).
  - **Resolved / Green**: Background `rgba(87, 242, 135, 0.12)`, text `#57F287`, border `1px solid rgba(87, 242, 135, 0.25)`.
  - **Needs Review / Yellow**: Background `rgba(254, 231, 92, 0.12)`, text `#FEE75C`, border `1px solid rgba(254, 231, 92, 0.25)`.
  - **Critical / Red**: Background `rgba(237, 66, 69, 0.14)`, text `#ED4245`, border `1px solid rgba(237, 66, 69, 0.3)`.
  - **AI Cluster / Blurple**: Background `rgba(88, 101, 242, 0.15)`, text `#7983F5`, border `1px solid rgba(88, 101, 242, 0.3)`.

### Ticket & Question List Items
- Container: Background `#181920`, border `1px solid #2B2D38`, padding `space-md`, radius 12px.
- Hover: Background `#1E1F29`, border color `#3B3E4F`.
- Left-edge semantic accent: 3px solid border on the active card’s left edge matching its status color (green, amber, red, or blurple).
- Top line: Channel indicator (`#help-hw3`), timestamp (`JetBrains Mono`), and priority chip.
- Middle: Student question snippet in `body-md` (`#F2F3F5`).
- Bottom metadata: Discord handle, student avatar (20x20 squircle), and AI draft readiness indicator.

### Input Fields & Search Bars
- Background: `#12131A`, border: `1px solid #2B2D38`, radius: 8px.
- Typography: `body-md` (`#F2F3F5`), placeholder: `#5C5E66`.
- Focus state: Border `#5865F2`, box-shadow: `0 0 0 1px #5865F2`.
- Quick-filter keyboard shortcuts: Display a right-aligned key badge (`⌘K`, `/`) styled with background `#1E1F29`, border `1px solid #2B2D38`, font `label-sm`.

### Tabs & View Switchers
- Underline-free, pill segment style.
- Active item: Background `#2B2D38`, text `#F2F3F5`, font-weight `600`.
- Inactive item: Background `transparent`, text `#949BA4`, hover text `#F2F3F5`.

### AI Cluster Cards
- Elevated card (`#1E1F29`) surrounded by a subtle blurple gradient outline (`1px solid rgba(88, 101, 242, 0.3)`).
- Includes similarity cluster count pill (e.g., `12 similar queries`), auto-generated summary title, confidence meter (progress bar in `#5865F2`), and a dual action pair: `Approve Bulk Answer` (Primary) vs. `De-cluster` (Ghost).