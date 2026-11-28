from django.core.management.base import BaseCommand

from api.image_shrink import shrink_stored_images
from api.models import Blog, Destination, Safari


class Command(BaseCommand):
    help = 'Shrink large photos stored inside safaris, destinations and blogs so public pages load faster.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report savings without saving changes.')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        before, after = shrink_stored_images((Safari, Destination, Blog), dry_run)
        action = 'Would save' if dry_run else 'Saved'
        self.stdout.write(f'{action} {(before - after) / 1_000_000:.1f} MB '
                          f'({before / 1_000_000:.1f} MB -> {after / 1_000_000:.1f} MB).')
