from django.db import migrations

# One-time pre-launch cleanup of data created while testing the site.
TEST_DATA_MODELS = ['BlogComment', 'Booking', 'ContactMessage', 'Subscriber', 'Testimonial']


def clear_test_data(apps, schema_editor):
    for name in TEST_DATA_MODELS:
        deleted, _ = apps.get_model('api', name).objects.all().delete()
        print(f'\n  Cleared {name}: {deleted} rows', end='')
    print()


class Migration(migrations.Migration):
    dependencies = [('api', '0029_shrink_stored_images')]
    operations = [migrations.RunPython(clear_test_data, migrations.RunPython.noop)]
