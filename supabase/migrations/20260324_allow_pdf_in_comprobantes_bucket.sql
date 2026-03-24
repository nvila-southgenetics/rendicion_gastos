-- Enable PDF uploads in comprobantes storage bucket.
-- Keeps existing image formats and extends allowed MIME types.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
]::text[]
where id = 'comprobantes';
