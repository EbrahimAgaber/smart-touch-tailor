# Project: Mulam Pipeline Redesign

## Architecture
- Codebase root: `c:\my-pos\V4`
- Project deliverables: `c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign`
- Tech Stack: React 18, React Router DOM 6 (HashRouter), Tailwind CSS v4, Zustand, Electron 22.3, Vite.
- Design System: `ui_ux_pro_max` "Workflow-First" ergonomics, dark theme / midnight slate tokens, unified typography (Cairo/Tajawal Arabic, IBM Plex Mono for numeric measurements).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Pipeline Audit Doc | Comprehensive UX audit across all Mulam pages, friction points & redundancies | M1 | Survey (Explorer 2) |
| 2 | UI/UX Blueprint & Wireframes | High-fidelity Markdown tables, ASCII wireframes, typography scales following ui_ux_pro_max | M1 | User Request R2 |
| 3 | Mulam Pipeline Navigation Rail | Unified top ribbon (`MulamSubNav`) linking New Order, Workshop Board, Alterations, Measurements | M2 | UX Audit Rec 1 |
| 4 | Alterations Escape & Autocomplete | Fix trapped user in `/alterations`, add customer lookup and local barcode generation | M2 | UX Audit Rec 5 |
| 5 | Alteration Payment Collection | Settlement modal upon alteration delivery to ensure financial integrity | M2 | UX Audit Rec 5 |
| 6 | Workshop Board Touch Ergonomics | >=44px touch targets, order progress bar, batch stage transitions | M2 | UX Audit Rec 4 |
| 7 | TailorPos Layout & Preview Drawer | Replace 33% permanent preview pane with on-demand preview modal/drawer, fix double-print bug | M2 | UX Audit Rec 3 |
| 8 | Advanced Order Options UI | Add UI controls for urgent order (`isUrgent`) and gift orders (`isGift`) in TailorPos | M2 | UX Audit Rec 3 |
| 9 | Garment & Measurement Normalization | Standardize measurement keys (`wrist`, `hand_opening`, `cuff`) and garment types across POS & measurements | M2 | UX Audit Rec 2 |
| 10 | Measurement-to-Order Direct Flow | Action button in MeasurementCapture to immediately launch a new order in TailorPos | M2 | UX Audit Rec 2 |
| 11 | Customer Hub Tailor Integration | Add measurement view and quick new order shortcuts on customer cards when `businessType === 'tailor'` | M2 | UX Audit Rec 6 |
| 12 | AppLayout & Sidebar Registration | Add Mulam routes (`/tailor-pos`, `/alterations`) cleanly to navigation sidebar | M2 | Explorer 1 Survey |
| 13 | Mock API Tailor Handlers | Implement `window.api.tailor` endpoints in `src/mockApi.js` for standalone browser resilience | M2 | Explorer 3 Tech Stack |
| 14 | Independent Judge & Review | Independent review comparing implemented frontend against mockups and design system | M3 | Acceptance Criteria |
| 15 | Adversarial & Integrity Audit | Challenger verification and Forensic Auditor clean verdict | M3 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | UX Audit & Blueprinting | Produce `MULAM_PIPELINE_AUDIT.md` and `MULAM_PIPELINE_BLUEPRINT.md` | Survey Complete | IN_PROGRESS |
| 2 | Frontend Pipeline Implementation | Implement unified components, navigation rail, page redesigns, and build verification | M1 | PLANNED |
| 3 | Independent Verification & Audit | Judge review vs mockups, challenger stress test, and forensic audit | M2 | PLANNED |

## Interface Contracts
### MulamSubNav Component
- Location: `src/components/mulam/MulamSubNav.jsx`
- Props: `activeTab` ('pos' | 'board' | 'alterations' | 'measurements'), `counters` ({ activeOrders, pendingAlterations, totalMeasurements })
- Actions: navigate to `/tailor-pos`, `/orders-board`, `/alterations`, `/measurements`, `/home`

### Measurement Schema Normalization
- Standard Keys: `length`, `shoulder`, `chest`, `waist`, `sleeve`, `neck`, `wrist`, `hand_opening`
- Options: `collar`, `cuff`, `pocket`
- Garments: `thobe`, `sirwal`, `shirt`, `bisht`, `suit`
