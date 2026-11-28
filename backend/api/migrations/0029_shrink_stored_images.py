from django.db import migrations

from api.image_shrink import shrink_stored_images


def shrink(apps, schema_editor):
    models = (apps.get_model('api', 'Safari'), apps.get_model('api', 'Destination'), apps.get_model('api', 'Blog'))
    before, after = shrink_stored_images(models)
    print(f'\n  Shrunk stored photos: {before / 1_000_000:.1f} MB -> {after / 1_000_000:.1f} MB')


class Migration(migrations.Migration):
    dependencies = [('api', '0028_remove_safari_is_open')]
    operations = [migrations.RunPython(shrink, migrations.RunPython.noop)]
