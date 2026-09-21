# LMSBox Import Engine

## Sprint 1 — Evolve Package Inspector

Reverse-engineer a published Evolve course into a structured object model.

Understanding only:

- No HTML rendering of course content
- No LMS lesson creation
- No OpenAI / AI enhancement
- No publishing

## Sprint 3 — Media attach + audio block

- Native **audio** interactive block (schema, template player, editor form, upload allowlist)
- Evolve mapper queues package-local media (`PendingMediaAttachment`)
- After draft create, client uploads ZIP bytes from VFS into each block and patches payloads
- Graphics → text `<img>`; video/audio/hotspot/carousel images wired to LMSBox URL fields
- Import API returns `blockId` so uploads target the correct blocks
- **Final Evolve scored assessments skipped by default** (competency / pass-fail / marks); in-page knowledge checks and mini quizzes convert to questionnaire blocks. Use an LMSBox Quiz lesson for the final assessment. Toggle in Import Engine UI.

### Sprint 3 flow

```
Inspect ZIP → Map (+ pending media, skip assessments) → Create Draft → Upload media → Patch payloads
```

## Pipeline

```
Upload ZIP → Extract → Detect Evolve → Read JSON → Object Model → Course Tree
                 └─(Sprint 2)→ Map → POST draft → Interactive lessons + Draft blocks
```

## Folder structure

```
import-engine/
  detectors/     PublisherDetector
  parsers/       EvolveParser (+ IPackageParser for future publishers)
  models/        Course, Page, Lesson, Block, Component, Asset
  mappers/       EvolveToLmsboxMapper, ImportDraftPlan (Sprint 2)
  services/      ZipExtractor, ObjectModelBuilder, AssetIndexer,
                 PreviewTreeBuilder, ImportEngineOrchestrator, StructuredLogger
  validators/    ValidationEngine
  config/        Detection markers + known component types (config over code)
  ui/            Package Inspector + Create Draft Course (React)
  tests/         Vitest unit tests + Evolve fixtures
```

## Object model hierarchy

```
Course
 └── Pages          (Evolve contentObjects → LMSBox lessons)
      └── Lessons   (Evolve articles → LMSBox native blocks)
           └── Blocks
                └── Components
                     └── Assets
```

Mapping rules:

- Each Evolve **page** becomes one LMSBox interactive lesson
- Each Evolve **article/lesson** on that page becomes one or more native blocks
- Articles titled **New Article Title** (page introductions) become a **Hero** block
- In-page **knowledge checks** / mini quizzes become questionnaire blocks
- Final scored Evolve assessments (marks / pass-fail) are skipped
- Empty articles are skipped rather than becoming empty lessons

Source IDs are preserved on the object model. LMSBox course/lesson IDs are created only when importing a Draft course.

## Developer Debug View

Admin UI: **Learning → Import Engine** (`/admin/import-engine`)

- Collapsible course tree (file-explorer style)
- Click any node → raw JSON + metadata on the right
- Validation report (missing JSON, missing assets, broken refs, duplicate IDs, unknown types)
- Asset index
- Mapping report (Sprint 2)
- Create Draft Course (Sprint 2)
- Structured pipeline logs

## Extensibility

Future publishers (Rise, Storyline, Adapt, Word, PDF) add a new `IPackageParser` implementation.
Shared models, validation contracts, preview tree, and UI stay unchanged.

## Run the Developer Debug View

`import-engine` is a library — the UI lives in `lmsbox.client`.

```bash
# from import-engine (starts the LMSBox Vite app)
npm run dev

# or from the client directly
cd ../lmsbox.client
npm run dev
```

Then open **Admin → Learning → Import Engine** (`/admin/import-engine`).

## Run unit tests

```bash
cd import-engine
npm install
npm test
```

## Fixture

`tests/fixtures/evolve-minimal` is a minimal Evolve-shaped package used by tests and as a reference layout.
