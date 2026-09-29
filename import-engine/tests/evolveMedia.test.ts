import { describe, expect, it } from 'vitest';
import {
  choosePackagedMedia,
  expandPackagePath,
  resolveAssetIdFromManifests,
} from '../src/utils/evolveMedia';
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

describe('resolveAssetIdFromManifests', () => {
  const assetId = '5ff2fefca6b2535263894e7a';

  it('follows the manifest record that names the file', () => {
    const files = [
      { path: 'course/en/assets.json', filename: 'assets.json' },
      { path: 'course/en/assets/kit-contents.png', filename: 'kit-contents.png' },
    ];
    const manifests = [
      {
        path: 'course/en/assets.json',
        text: JSON.stringify([{ _id: assetId, path: 'course/en/assets/kit-contents.png' }]),
      },
    ];
    expect(resolveAssetIdFromManifests(assetId, manifests, files)).toBe(
      'course/en/assets/kit-contents.png'
    );
  });

  it('uses renditions beside an asset.json whose folder is not the id', () => {
    const files = [
      { path: 'course/en/assets/kit/asset.json', filename: 'asset.json' },
      { path: 'course/en/assets/kit/large.jpg', filename: 'large.jpg' },
    ];
    const manifests = [
      { path: 'course/en/assets/kit/asset.json', text: JSON.stringify({ _id: assetId }) },
    ];
    expect(resolveAssetIdFromManifests(assetId, manifests, files)).toBe(
      'course/en/assets/kit/large.jpg'
    );
  });

  it('returns empty when no manifest mentions the id', () => {
    expect(resolveAssetIdFromManifests(assetId, [{ path: 'a.json', text: '{}' }], [])).toBe('');
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
