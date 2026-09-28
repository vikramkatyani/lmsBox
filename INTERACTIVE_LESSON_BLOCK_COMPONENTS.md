# Interactive lesson block components

Reference for every block type in the interactive lesson editor. Each block is added from **Add block**, then filled in on its own form. The lesson can hold up to **100** blocks.

Every block form starts with the same two fields, then the fields for that block type.

| Field | Required | What it is |
| --- | --- | --- |
| Block title | Yes | Name of the block in the lesson outline. This is the editor label. It is separate from any title learners see inside the block. |
| Block type | Yes when adding | Chooses which form and learner layout to use. The type cannot be changed after the block is saved. |

Required fields are marked with `*` in the editor. Character limits below are the maximum the form and server accept.

---

## Shared controls

Several block types reuse the same controls. Those controls are described once here, then named in each block.

### Title and introduction

Optional text shown to learners at the top of the block.

| Field | Limit | What it is |
| --- | --- | --- |
| Title | 200 characters | Optional heading above the block content. |
| Introduction | 500 characters | Optional short paragraph under the title. |

### Image

Used wherever a block offers an image. The author can paste an `http` or `https` URL, or choose a file. Chosen files upload when the block is saved. The URL can be up to **2,000** characters. A preview is shown, and the image can be removed.

### Icon

An optional Lucide icon, chosen from a searchable picker. The stored key must be a recognised icon and can be up to **80** characters. Leave it empty to show no icon.

### Rich text

Used for longer formatted copy. The toolbar supports:

- Paragraph style, plus Heading 1, Heading 2, and Heading 3
- Font size
- Bold, italic, underline, and strikethrough
- Bulleted and numbered lists
- Align left, centre, and right
- Links (`http`, `https`, or `mailto`). Links open in a new tab
- Tables, including insert, and extra table controls while the cursor is inside a table

A plain-text copy is stored alongside the formatted HTML so older content still renders. The character limit counts the visible text, not the HTML tags.

---

## Hero

**Type:** `hero`

A lesson introduction banner. Learners see an optional kicker, a title, an optional intro, optional short labels (meta pills), and an optional background image. With no image, the banner uses the solid primary style. The block completes automatically when it is shown.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Kicker | No | 120 characters | Short label above the title, for example “Module introduction”. |
| Title | Yes | 200 characters | Main heading learners see. |
| Intro | No | 500 characters | Supporting sentence under the title. |
| Meta pills | No | 6 pills, 40 characters each | Short labels under the intro, such as duration or format. Each pill is its own text field. Pills can be added and removed. |
| Background image | No | Image | Optional background. See **Image**. |

---

## Information cards

**Type:** `cards`

A grid of information cards. Two cards use two columns; any other count uses a three-column grid. The block completes automatically when it is shown. At least **1** card is required, and at most **6**.

Each card:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Label | No | 80 characters | Small label above the card title, for example “Concept”. |
| Title | Yes | 200 characters | Card heading. |
| Body | Yes | 1,000 characters | Card description. Plain text. |
| Style | No | Default, Accent, or Warn | Visual variant of the card. Defaults to Default. |

Cards can be reordered and removed.

---

## Click reveal

**Type:** `reveal`

Panels whose body stays hidden until the learner opens each one. The block completes after every panel has been revealed. At least **1** panel is required, and at most **8**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Hint | No | 160 characters | Nudge under the panels, for example “Select a card to reveal the answer”. |

Each panel:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | Yes | 200 characters | Panel heading the learner sees before opening it. |
| Hidden body | Yes | 2,000 characters | Content shown once the panel is opened. Plain text. |
| Style | No | Default or Warn | Visual variant. Defaults to Default. |
| Prompt label | No | 60 characters | Short prompt on the closed panel, for example “Click to reveal”. |
| Panel icon | No | Icon | See **Icon**. |
| Panel image | No | Image | Optional image inside the revealed content. See **Image**. |

Panels can be reordered and removed.

---

## Flip cards

**Type:** `flip`

Two-sided cards. The front shows a title; the learner flips the card to read the back. The block completes after every card has been flipped. At least **1** card is required, and at most **8**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |

Each card:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Front title | Yes | 200 characters | Term or question on the front of the card. |
| Back body | Yes | 1,000 characters | Answer revealed on the back. Rich text. See **Rich text**. |
| Front hint | No | 60 characters | Small label on the front, for example “Tap to flip”. |
| Back hint | No | 60 characters | Small label on the back, for example “Definition”. |

Cards can be reordered and removed.

---

## Remember box

**Type:** `remember`

A highlighted takeaway. The block completes automatically when it is shown.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Label | No | 60 characters | Label above the message. Defaults to “Remember”. |
| Message | Yes | 2,000 characters | The point learners should carry forward. Rich text. See **Rich text**. |

---

## Warning box

**Type:** `warning`

A caution for a limit, exclusion, or common mistake. The block completes automatically when it is shown.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Label | No | 60 characters | Label above the message. Defaults to “Warning”. |
| Message | Yes | 2,000 characters | The caution itself. Rich text. See **Rich text**. |

---

## Timeline

**Type:** `timeline`

Numbered stages the learner expands. Numbers are assigned automatically from the order of the stages. The block completes after every stage has been expanded. At least **1** stage is required, and at most **10**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Hint | No | 160 characters | Nudge above the timeline. Defaults to “Select a stage to expand it”. |

Each stage:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | Yes | 200 characters | Stage heading. |
| Body | Yes | 2,000 characters | What happens at this stage. Plain text. |

Stages can be reordered and removed.

---

## Reflection panel

**Type:** `reflection`

An open question the learner answers in their own words. There is no correct answer. The block completes when they save a non-empty reflection.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Label | No | 60 characters | Label above the question. Defaults to “Your reflection”. |
| Question | Yes | 200 characters | The question learners answer. |
| Prompt | No | 500 characters | Supporting sentence under the question, for example “There is no right answer here”. |
| Placeholder | No | 160 characters | Hint text inside the empty answer box. If left blank, learners see “Write a few sentences…”. |

---

## Hotspot diagram

**Type:** `hotspot`

An image with numbered pins. Opening a pin shows its title, body, and optional popup image. The block completes after every pin has been opened. At least **1** pin is required, and at most **12**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Diagram image | Yes | Image, URL up to 2,000 characters | Background diagram. See **Image**. A pin-position preview is shown once an image is set. |
| Image description | No | 300 characters | Alternative text for screen readers. |

Each pin:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Top position (%) | Yes | 0 to 100 | How far down the image the pin sits, as a percentage. |
| Left position (%) | Yes | 0 to 100 | How far across the image the pin sits, as a percentage. |
| Title | Yes | 120 characters | Name of this part of the diagram. |
| Body | Yes | 600 characters | Detail shown when the learner opens the pin. Plain text. |
| Popup image | No | Image | Optional image inside the pin popup. See **Image**. |

Pins are numbered in list order and can be reordered and removed.

---

## Process flow

**Type:** `process`

A sequence the learner steps through one reveal at a time, with a diagram of stage labels above the steps. The block completes after the final step. At least **1** step is required, and at most **8**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Start button label | No | 60 characters | Label of the button that reveals the first step. Defaults to “Start the sequence”. |
| Finish message | No | 500 characters | Takeaway shown once every step has been revealed. |

Each step:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | Yes | 200 characters | Step heading. |
| Body | Yes | 1,000 characters | What happens during this step. Plain text. |
| Stage label | No | 60 characters | Short label used in the diagram above the steps. Provide one for every step, or leave them all empty. If only some steps have a label, the diagram falls back to the step titles. |
| Step icon | No | Icon | See **Icon**. The same icon is used on the matching diagram stage. |
| Step image | No | Image | Optional image for the step. See **Image**. |

Steps can be reordered and removed.

---

## Flowchart

**Type:** `flowchart`

A connected sequence of stages. Selecting a stage shows its detail. The first stage added starts as **Start**; later stages default to **Step**. If a shape is left unset, the first stage is treated as Start and the last stage as End. The block completes after every stage has been opened. At least **1** stage is required, and at most **10**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Heading | No | 200 characters | Heading above the flowchart. |
| Introduction | No | 500 characters | Short introduction under the heading. |
| Hint | No | 160 characters | Nudge above the diagram. Defaults to “Select a stage to read more”. |

Each stage:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | Yes | 200 characters | Stage heading. |
| Body | Yes | 2,000 characters | Detail shown when the stage is selected. Plain text. |
| Shape | No | Start, Step, Decision, or End | Shape of the stage in the diagram. |
| Stage icon | No | Icon | See **Icon**. |
| Stage image | No | Image | Optional image in the stage detail. See **Image**. |

Stages can be reordered and removed. The form includes a live preview once every stage has a title and body.

---

## Questionnaire

**Type:** `questionnaire`

A knowledge check. The block completes when every question has been answered.

The active limit is **1 question per block**. The form and server can allow up to **20** questions per block when that limit is raised. AI generation creates single-answer multiple-choice questions only, up to the active question limit (currently 1, and never more than 10).

**Content description** is for the author and for AI. It is not shown to learners.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Content description | Yes | — | Learning goals and context. Required even when questions are written by hand, because it is the source for AI generation. |
| Show feedback after each question | No | On by default | When on, the learner sees the feedback for that question after they answer it. |

Each question:

| Field | Required | What it is |
| --- | --- | --- |
| Question text | Yes | The question learners read. |
| Type | Yes | **Single choice** (one correct option, radio buttons), **Multiple choice** (one or more correct options, checkboxes), or **Short text** (a free-text answer). |
| Options | Yes for choice questions | At least two options. Each option has option text and a **Correct** checkbox. Not shown for short-text questions. |
| Correct feedback | No | Up to 1,000 characters. For choice questions, shown when the answer is correct. For short text, the label is “Feedback after saving” and it is an optional note after the answer is saved. |
| Incorrect feedback | No | Up to 1,000 characters. Shown when a choice answer is wrong. Not used for short text. |
| Question image | No | Optional image with the question. See **Image**. |

AI controls (optional):

| Field | What it is |
| --- | --- |
| Number of questions | How many single-answer MCQs to generate. Shown only when more than one question per block is allowed. Range is 1 to the AI cap. |
| Generate MCQ | Builds questions from the content description. The author can edit the question and options afterwards. Generation needs a content description. |

---

## Ordering

**Type:** `ordering`

Learners rearrange items, then press **Check order**. Items are written in the correct order; learners see them shuffled and move them with up and down arrows.

The block is marked complete when the learner checks an answer. A correct order shows the correct feedback and locks the list. An incorrect order shows the incorrect feedback, and the learner can reset and try again.

At least **2** items are required, and at most **10**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | Optional title above the activity. The introduction field is not used on this form. |
| Instruction | No | 1,000 characters | Prompt above the list, for example “Put these steps in the correct order.” |
| Hint | No | 160 characters | Nudge about how to rearrange. Defaults to “Use the arrows to rearrange, then check your answer.” |
| Correct feedback | No | 1,000 characters | Message after a correct check. If empty, learners see “You put every item in the right order.” |
| Incorrect feedback | No | 1,000 characters | Message after an incorrect check. If empty, learners see “That order is not quite right. Rearrange the items and check again.” |

Each item:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Text | Yes | 300 characters | The item, written in its correct position. |

Items can be reordered and removed. The order in the form is the correct order.

---

## Carousel

**Type:** `carousel`

One slide at a time, with previous and next controls. The block completes after every slide has been viewed, including the first slide when it loads. At least **1** slide is required, and at most **10**.

**Content description** is for the author and for AI. It is not shown to learners.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Content description | Yes | — | Learning purpose and tone. Required for AI generation and for saving the block. |

Each slide:

| Field | Required | What it is |
| --- | --- | --- |
| Slide title | Yes | Heading of the slide. |
| Slide body | Yes | Main text of the slide. Plain text. |
| Slide image | No | Optional image. See **Image**. Alternative text comes from the slide title. |

Slides can be reordered and removed.

AI controls (optional):

| Field | What it is |
| --- | --- |
| Number of slides | How many slides to generate, from 1 to 10. |
| Generate slides | Builds slides from the content description. If slides already exist, generating replaces them. Titles, body text, and images can be edited afterwards. |

---

## Accordion

**Type:** `accordion`

Expandable sections. The block completes after every panel has been expanded at least once. At least **1** panel is required, and at most **10**.

**Content description** is for the author and for AI. It is not shown to learners.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | See **Title and introduction**. |
| Introduction | No | 500 characters | See **Title and introduction**. |
| Content description | Yes | — | Learning purpose and tone. Required for AI generation and for saving the block. |

Each panel:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Panel title | Yes | — | Heading of the collapsed section. |
| Panel body | Yes | 10,000 characters | Content shown when the panel is expanded. Rich text. See **Rich text**. |
| Panel icon | No | Icon | See **Icon**. |
| Panel image | No | Image | Optional image inside the panel. See **Image**. |

Panels can be reordered and removed. The form includes a live preview once every panel has a title and body.

AI controls (optional):

| Field | What it is |
| --- | --- |
| Number of panels | How many panels to generate, from 1 to 10. |
| Generate panels | Builds panels from the content description. If panels already exist, generating replaces them. Titles, body, icons, and images can be edited afterwards. AI does not set icons or images. |

---

## Tabs

**Type:** `tabs`

A row of tabs. Selecting a tab shows that panel. The block completes after every tab has been viewed. At least **1** tab is required, and at most **10**.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Heading | No | 200 characters | Heading above the tabs. |
| Introduction | No | 500 characters | Short introduction under the heading. |

Each tab:

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Tab title | Yes | 200 characters | Label on the tab itself. |
| Tab body | Yes | 2,000 characters | Content shown when the tab is selected. Plain text. |
| Tab icon | No | Icon | See **Icon**. |
| Tab image | No | Image | Optional image in the tab content. See **Image**. |

Tabs can be reordered and removed.

---

## Text

**Type:** `text`

A heading, an optional subheading, and a formatted body. Uses a fixed layout.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Heading | No | 200 characters | Main heading learners see. |
| Subheading | No | 300 characters | Supporting line under the heading. |
| Text content | Yes | 10,000 characters | Body copy. Rich text. See **Rich text**. |
| Show Continue button | No | On by default | When on, learners must tap **Continue** to complete the block. When off, the block completes automatically when it is shown. |

---

## Video

**Type:** `video`

An embedded video with an optional title and description. Uses a fixed layout.

A direct file (uploaded video, MP4, or WebM) completes when playback reaches the end. YouTube and Vimeo embeds also listen for the player’s ended event, and they show a **Mark video complete** button so the learner can continue if that event is not received. If a file fails to load, the same button is shown.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | Title above the video. |
| Description | No | 2,000 characters | Text under the video. Older blocks may store this as a caption; the form reads that and saves it as the description. |
| Upload video | One of upload or URL | 500 MB | File chosen on the form. Accepted types: MP4, WebM, MOV, AVI, MKV, WMV. On a new block the file uploads when the block is saved. On an existing block it uploads immediately, and the block still needs to be saved. |
| Or paste video URL | One of upload or URL | 2,000 characters | An `http` or `https` address. Supports uploaded-file URLs, direct MP4/WebM URLs, and YouTube or Vimeo links. Disabled while a file is waiting to upload, because the URL is filled in after upload. |

The URL can be left empty while the block is still a draft. Rendering the block for learners requires a URL.

---

## Audio

**Type:** `audio`

An audio player with an optional title and description. Uses a fixed layout. The block completes when playback reaches the end. If the file fails to load, a **Mark audio complete** button is shown.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| Title | No | 200 characters | Title above the player. |
| Description | No | 2,000 characters | Text under the player. |
| Upload audio | One of upload or URL | — | File chosen on the form. Accepted types: MP3, WAV, OGG, M4A, AAC, FLAC. Same upload timing as video: on save for a new block, immediately for an existing block. |
| Or paste audio URL | One of upload or URL | 2,000 characters | An `http` or `https` address for a direct audio file. Disabled while a file is waiting to upload. |

The URL can be left empty while the block is still a draft. Rendering the block for learners requires a URL.

---

## Completion at a glance

| Block | How the learner completes it |
| --- | --- |
| Hero | Shown |
| Information cards | Shown |
| Remember box | Shown |
| Warning box | Shown |
| Text | **Continue**, or shown when that button is turned off |
| Click reveal | Every panel opened |
| Flip cards | Every card flipped |
| Timeline | Every stage expanded |
| Reflection panel | A non-empty reflection saved |
| Hotspot diagram | Every pin opened |
| Process flow | Final step reached |
| Flowchart | Every stage opened |
| Questionnaire | Every question answered |
| Ordering | **Check order** submitted |
| Carousel | Every slide viewed |
| Accordion | Every panel expanded |
| Tabs | Every tab viewed |
| Video | File played to the end, or the embed ended / marked complete |
| Audio | Played to the end, or marked complete if the file fails to load |
