# LMSBox Import Engine — Sprint 1

**Evolve Package Inspector** — reverse-engineer a published Evolve course into a structured object model.

This milestone is **understanding only**:

- No HTML rendering of course content
- No LMS lesson creation
- No OpenAI / AI enhancement
- No publishing

## Pipeline

```
Upload ZIP → Extract → Detect Evolve → Read JSON → Object Model → Course Tree
```

## Folder structure

```
import-engine/
  detectors/     PublisherDetector
  parsers/       EvolveParser (+ IPackageParser for future publishers)
  models/        Course, Page, Lesson, Block, Component, Asset
  services/      ZipExtractor, ObjectModelBuilder, AssetIndexer,
                 PreviewTreeBuilder, ImportEngineOrchestrator, StructuredLogger
  validators/    ValidationEngine
  config/        Detection markers + known component types (config over code)
  ui/            Developer Debug View (React)
  tests/         Vitest unit tests + Evolve fixtures
```

## Object model hierarchy

```
Course
 └── Pages          (Evolve contentObjects)
      └── Lessons   (Evolve articles)
           └── Blocks
                └── Components
                     └── Assets
```

Source IDs are preserved. LMSBox never generates entity IDs.

## Developer Debug View

Admin UI: **Learning → Import Engine** (`/admin/import-engine`)

- Collapsible course tree (file-explorer style)
- Click any node → raw JSON + metadata on the right
- Validation report (missing JSON, missing assets, broken refs, duplicate IDs, unknown types)
- Asset index
- Structured pipeline logs

## Extensibility

Future publishers (Rise, Storyline, Adapt, Word, PDF) add a new `IPackageParser` implementation.
Shared models, validation contracts, preview tree, and UI stay unchanged.

## Run unit tests

```bash
cd import-engine
npm install
npm test
```

## Fixture

`tests/fixtures/evolve-minimal` is a minimal Evolve-shaped package used by tests and as a reference layout.
