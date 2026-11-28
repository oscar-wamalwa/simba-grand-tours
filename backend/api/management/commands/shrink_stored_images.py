import base64
import io

from django.core.management.base import BaseCommand
from PIL import Image

from api.models import Destination, Safari

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


class Command(BaseCommand):
    help = 'Shrink large photos stored inside safaris and destinations so public pages load faster.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report savings without saving changes.')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        before_total = after_total = 0
        for model in (Safari, Destination):
            for item in model.objects.all():
                images = item.images or []
                shrunk = [shrink_data_url(image) for image in images]
                before = sum(len(image) for image in images if isinstance(image, str))
                after = sum(len(image) for image in shrunk if isinstance(image, str))
                before_total += before
                after_total += after
                if shrunk != images and not dry_run:
                    model.objects.filter(pk=item.pk).update(images=shrunk)
        action = 'Would save' if dry_run else 'Saved'
        self.stdout.write(f'{action} {(before_total - after_total) / 1_000_000:.1f} MB '
                          f'({before_total / 1_000_000:.1f} MB -> {after_total / 1_000_000:.1f} MB).')
