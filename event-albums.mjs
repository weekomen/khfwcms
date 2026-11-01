// The imported files remain an immutable archive. Once a page is marked as
// managed, its saved list is authoritative, including a deliberately empty list.
export function applyEventAlbumDefaults(content, manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(content.venturePages)) return content;
  for (const page of content.venturePages) {
    if (!page || page.albumManaged === true) continue;
    const archived = manifest[page.id]?.photos;
    if (!Array.isArray(archived) && !Array.isArray(page.photos)) continue;
    const records = [], positions = new Map(), ids = new Set();
    for (const source of [...(Array.isArray(archived) ? archived : []), ...(Array.isArray(page.photos) ? page.photos : [])]) {
      if (!source || typeof source.src !== 'string' || !source.src) continue;
      let photoId = String(source.id || `photo-${records.length + 1}`);
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(photoId)) photoId = `photo-${records.length + 1}`;
      const oldPosition = positions.get(source.src);
      if (oldPosition !== undefined) {
        const previous = records[oldPosition];
        records[oldPosition] = { ...previous, filename: String(source.filename ?? previous.filename).slice(0, 200), tag: String(source.tag ?? previous.tag).slice(0, 100) };
        continue;
      }
      const baseId = photoId;
      let suffix = 1;
      while (ids.has(photoId)) photoId = `${baseId.slice(0, 65)}-${suffix++}`;
      ids.add(photoId);
      const photo = {
        id: photoId, src: source.src,
        filename: String(source.filename || '').slice(0, 200), tag: String(source.tag || '').slice(0, 100),
        width: Number.isInteger(source.width) && source.width > 0 ? source.width : 1,
        height: Number.isInteger(source.height) && source.height > 0 ? source.height : 1
      };
      if (typeof source.thumb === 'string' && source.thumb) photo.thumb = source.thumb;
      positions.set(photo.src, records.length); records.push(photo);
    }
    page.photos = records;
    page.albumManaged = true;
  }
  return content;
}
