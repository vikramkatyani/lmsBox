import { describe, expect, it } from 'vitest';
import { choosePackagedMedia, expandPackagePath } from '../src/utils/evolveMedia';
import type { Asset } from '../src/models/Asset';

function asset(path: string, mediaType: string): Asset {
  const filename = path.split('/').pop() || path;
  return {
    id: `asset:${path}`,
    filename,
    path,
    mediaType,
    exists: true,
  };
}

describe('choosePackagedMedia', () => {
  const assetId = '64c79eed41c7210ba1c69b41';
  const files = [
    { path: `course/en/assets/${assetId}/asset.json`, filename: 'asset.json' },
    { path: `course/en/assets/${assetId}/small.png`, filename: 'small.png' },
    { path: `course/en/assets/${assetId}/original.png`, filename: 'original.png' },
  ];

  it('replaces an asset.json reference with the original rendition', () => {
    expect(choosePackagedMedia(`course/en/assets/${assetId}/asset.json`, files)).toBe(
      `course/en/assets/${assetId}/original.png`
    );
  });

  it('replaces a bare asset id with the image in that folder', () => {
    expect(choosePackagedMedia(assetId, files)).toBe(
      `course/en/assets/${assetId}/original.png`
    );
  });

  it('keeps an explicit image path', () => {
    expect(choosePackagedMedia('course/en/assets/kit-contents.png', files)).toBe(
      'course/en/assets/kit-contents.png'
    );
  });
});

describe('expandPackagePath', () => {
  it('returns the sibling image when the indexed file is asset.json', () => {
    const assetId = '5ff2fe93a6b2535263894e79';
    const imagePath = `course/en/assets/${assetId}/large.jpg`;
    const resolved = expandPackagePath(`course/en/assets/${assetId}/asset.json`, [
      asset(`course/en/assets/${assetId}/asset.json`, 'application/json'),
      asset(imagePath, 'image/jpeg'),
    ]);
    expect(resolved).toBe(imagePath);
  });
});
