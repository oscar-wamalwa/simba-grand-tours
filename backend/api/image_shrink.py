import base64
import io

from PIL import Image

MAX_DIMENSION = 1600
MIN_BYTES_TO_SHRINK = 150_000


def shrink_data_url(value):
    """Return a smaller JPEG data URL, or the original value if it can't be improved."""
    if not isinstance(value, str) or not value.startswith('data:image/') or ';base64,' not in value:
        return value
    header, encoded = value.split(',', 1)
    if 'gif' in header or 'svg' in header:
        return value
    try:
        raw = base64.b64decode(encoded)
        if len(raw) < MIN_BYTES_TO_SHRINK:
            return value
        image = Image.open(io.BytesIO(raw))
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
        buffer = io.BytesIO()
        image.convert('RGB').save(buffer, 'JPEG', quality=80, optimize=True, progressive=True)
    except Exception:
        return value
    shrunk = 'data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')
    return shrunk if len(shrunk) < len(value) else value


def shrink_stored_images(models, dry_run=False):
    """Shrink image fields on the given (Safari, Destination, Blog) model classes. Returns (before, after) sizes in bytes."""
    safari, destination, blog = models
    before_total = after_total = 0
    for model in (safari, destination):
        for item in model.objects.all():
            images = item.images or []
            shrunk = [shrink_data_url(image) for image in images]
            before_total += sum(len(i) for i in images if isinstance(i, str))
            after_total += sum(len(i) for i in shrunk if isinstance(i, str))
            if shrunk != images and not dry_run:
                model.objects.filter(pk=item.pk).update(images=shrunk)
    for item in blog.objects.exclude(image__isnull=True).exclude(image=''):
        shrunk = shrink_data_url(item.image)
        before_total += len(item.image)
        after_total += len(shrunk)
        if shrunk != item.image and not dry_run:
            blog.objects.filter(pk=item.pk).update(image=shrunk)
    return before_total, after_total
