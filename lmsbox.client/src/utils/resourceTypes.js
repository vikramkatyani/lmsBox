const RESOURCE_TYPE_LABELS = {
  pdf: 'PDF',
  html: 'HTML',
  video: 'Video',
};

export function formatResourceTypeLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

export function getResourceTypeMenuLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}
